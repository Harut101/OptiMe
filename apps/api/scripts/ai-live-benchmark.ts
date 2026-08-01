import type { INestApplication } from '@nestjs/common';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  SubscriptionEnvironment,
  SubscriptionPlan,
  SubscriptionProvider,
  SubscriptionStatus
} from '@prisma/client';
import request from 'supertest';

import type { PrismaService } from '../src/prisma/prisma.service';
import type { DailyPlanJson } from '../src/modules/daily-plans/daily-plan-json.schema';
import {
  benchmarkLocaleSlug,
  configuredBenchmarkLocales,
  type BenchmarkLocale
} from './ai-live-benchmark-locales';
import {
  evaluateBenchmarkPlanQuality,
  summarizePlanQuality,
  type BenchmarkPlanQuality
} from './ai-live-benchmark-quality';

const HARD_MAX_COST_USD = 10;
const REPORT_SCHEMA_VERSION = 'ai-live-benchmark.v2';
const DEFAULT_FLOW_LABEL = 'nutrition-agent-authoritative-v3';
const RUN_PREFIX = `ai-benchmark-${Date.now()}`;
type Tier = 'FREE' | 'PLUS' | 'PRO';
const ALL_TIERS: Tier[] = ['FREE', 'PLUS', 'PRO'];

interface Scenario {
  suffix: string;
  appMode: 'NUTRITION_ONLY' | 'NUTRITION_AND_TRAINING';
  dietType: 'OMNIVORE' | 'VEGETARIAN';
  allergies: string[];
  excludedFoods: string[];
  preferredFoods: string[];
}

interface BenchmarkRequestLog {
  userId: string;
  agent: string;
  operation: string;
  route: string;
  model: string;
  status: string;
  retryAttempt: boolean;
  inputTokens: number;
  outputTokens: number;
  estimatedCostMicrousd: number | null;
  latencyMs: number;
}

const scenarios: Scenario[] = [
  {
    suffix: 'balanced-training',
    appMode: 'NUTRITION_AND_TRAINING',
    dietType: 'OMNIVORE',
    allergies: ['peanuts'],
    excludedFoods: ['avocado'],
    preferredFoods: ['rice', 'eggs', 'salmon']
  },
  {
    suffix: 'vegetarian-rest',
    appMode: 'NUTRITION_ONLY',
    dietType: 'VEGETARIAN',
    allergies: [],
    excludedFoods: ['mushrooms'],
    preferredFoods: ['oats', 'yogurt', 'lentils']
  }
];

async function main() {
  const maxCostUsd = positiveNumber(
    'AI_BENCHMARK_MAX_COST_USD',
    HARD_MAX_COST_USD
  );
  if (maxCostUsd > HARD_MAX_COST_USD) {
    throw new Error(
      `AI_BENCHMARK_MAX_COST_USD cannot exceed ${HARD_MAX_COST_USD}.`
    );
  }

  const profilesPerTier = Math.min(
    10,
    positiveInteger('AI_BENCHMARK_PROFILES_PER_TIER', 2)
  );
  const tiers = configuredTiers();
  const locales = configuredBenchmarkLocales();
  const label = process.env.AI_BENCHMARK_LABEL?.trim() || null;
  const flowLabel =
    process.env.AI_BENCHMARK_FLOW_LABEL?.trim() || DEFAULT_FLOW_LABEL;
  if (process.env.AI_BENCHMARK_REAL_CALLS_ENABLED !== 'true') {
    emitReport({
      reportSchemaVersion: REPORT_SCHEMA_VERSION,
      mode: 'dry-run',
      flowLabel,
      label,
      realCallsEnabled: false,
      tiers,
      locales,
      profilesPerTier,
      profilesPerTierPerLocale: profilesPerTier,
      plannedPlanGenerations: profilesPerTier * tiers.length * locales.length,
      hardMaxCostUsd: HARD_MAX_COST_USD,
      configuredMaxCostUsd: maxCostUsd,
      message: 'No OpenAI calls were made.'
    });
    return;
  }

  const databaseUrl = benchmarkDatabaseUrl();
  requireOpenAiConfiguration(tiers);
  configureRun(databaseUrl, maxCostUsd);

  const [{ createTestApp }, foodSeed, exerciseSeed, budgetModule] =
    await Promise.all([
      import('../test/helpers/test-app'),
      import('../prisma/seeds/foods/seed'),
      import('../prisma/seeds/exercises/seed'),
      import('../src/modules/ai-operation-logs/ai-benchmark-budget.service')
    ]);
  const ctx = await createTestApp();
  const budget = ctx.app.get(budgetModule.AiBenchmarkBudgetService);
  const userIds: string[] = [];
  const tierByUserId = new Map<string, Tier>();
  const localeByUserId = new Map<string, BenchmarkLocale>();
  const outcomes: Array<{
    tier: Tier;
    locale: BenchmarkLocale;
    scenario: string;
    status: string;
    fallbackReason: string | null;
    quality: BenchmarkPlanQuality | null;
  }> = [];
  const startedAt = new Date();

  try {
    await foodSeed.seedFoodCatalog(ctx.prisma);
    await exerciseSeed.seedExerciseCatalog(ctx.prisma);

    benchmarkLoop: for (const tier of tiers) {
      for (const locale of locales) {
        for (let index = 0; index < profilesPerTier; index += 1) {
          if (budget.snapshot().exhausted) break benchmarkLoop;
          const scenario = scenarios[index % scenarios.length];
          const user = await registerUser(
            ctx.app,
            ctx.prisma,
            `${RUN_PREFIX}-${tier.toLowerCase()}-${benchmarkLocaleSlug(locale)}-${index}@example.test`,
            locale
          );
          userIds.push(user.userId);
          tierByUserId.set(user.userId, tier);
          localeByUserId.set(user.userId, locale);
          await configureProfile(ctx.app, user.accessToken, scenario, index);
          await applyTier(ctx.prisma, user.userId, tier);

          const response = await request(ctx.app.getHttpServer())
            .post('/v1/daily-plans/generate')
            .set('Authorization', `Bearer ${user.accessToken}`)
            .send({ forceRegenerate: false });
          const fallbackReason = response.body?.plan?.debug?.fallbackReason;
          const plan = response.body?.plan as DailyPlanJson | undefined;
          outcomes.push({
            tier,
            locale,
            scenario: scenario.suffix,
            status:
              typeof response.body?.status === 'string'
                ? response.body.status
                : `HTTP_${response.status}`,
            fallbackReason:
              typeof fallbackReason === 'string' ? fallbackReason : null,
            quality: plan
              ? evaluateBenchmarkPlanQuality(plan, {
                  trainingExpected:
                    scenario.appMode === 'NUTRITION_AND_TRAINING',
                  preferredFoods: scenario.preferredFoods,
                  expectedMealCount: 3,
                  expectedMenuOptionCount: expectedMenuOptionCount(tier)
                })
              : null
          });
        }
      }
    }

    const logs = await ctx.prisma.aiRequestLog.findMany({
      where: { userId: { in: userIds }, createdAt: { gte: startedAt } },
      select: {
        userId: true,
        agent: true,
        operation: true,
        route: true,
        model: true,
        status: true,
        retryAttempt: true,
        inputTokens: true,
        outputTokens: true,
        estimatedCostMicrousd: true,
        latencyMs: true
      }
    });
    const telemetry = summarize(logs, outcomes.length);
    emitReport({
      reportSchemaVersion: REPORT_SCHEMA_VERSION,
      mode: 'real',
      flowLabel,
      label,
      tiers,
      locales,
      profilesPerTierPerLocale: profilesPerTier,
      hardMaxCostUsd: HARD_MAX_COST_USD,
      budget: budget.snapshot(),
      completedPlanGenerations: outcomes.length,
      readyPlans: outcomes.filter((item) => item.status === 'READY').length,
      degradedReadyPlans: outcomes.filter(
        (item) => item.status === 'READY' && item.fallbackReason !== null
      ).length,
      fallbackPlans: outcomes.filter((item) => item.status === 'FALLBACK')
        .length,
      outcomes,
      quality: summarizePlanQuality(
        outcomes.flatMap((outcome) => outcome.quality ?? [])
      ),
      telemetry,
      byTier: Object.fromEntries(
        tiers.map((tier) => {
          const tierOutcomes = outcomes.filter(
            (outcome) => outcome.tier === tier
          );
          const tierLogs = logs.filter(
            (log) => tierByUserId.get(log.userId) === tier
          );
          return [
            tier,
            {
              completedPlanGenerations: tierOutcomes.length,
              readyPlans: tierOutcomes.filter(
                (outcome) => outcome.status === 'READY'
              ).length,
              fallbackPlans: tierOutcomes.filter(
                (outcome) => outcome.status === 'FALLBACK'
              ).length,
              quality: summarizePlanQuality(
                tierOutcomes.flatMap((outcome) => outcome.quality ?? [])
              ),
              telemetry: summarize(tierLogs, tierOutcomes.length)
            }
          ];
        })
      ),
      byLocale: Object.fromEntries(
        locales.map((locale) => {
          const localeOutcomes = outcomes.filter(
            (outcome) => outcome.locale === locale
          );
          const localeLogs = logs.filter(
            (log) => localeByUserId.get(log.userId) === locale
          );
          return [
            locale,
            {
              completedPlanGenerations: localeOutcomes.length,
              readyPlans: localeOutcomes.filter(
                (outcome) => outcome.status === 'READY'
              ).length,
              fallbackPlans: localeOutcomes.filter(
                (outcome) => outcome.status === 'FALLBACK'
              ).length,
              quality: summarizePlanQuality(
                localeOutcomes.flatMap((outcome) => outcome.quality ?? [])
              ),
              telemetry: summarize(localeLogs, localeOutcomes.length)
            }
          ];
        })
      )
    });
  } finally {
    if (userIds.length > 0) {
      await ctx.prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await ctx.app.close();
  }
}

function configureRun(databaseUrl: string, maxCostUsd: number) {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET ??= 'benchmark-only-secret';
  process.env.EMAIL_PROVIDER = 'development';
  process.env.AUTH_RATE_LIMIT_ENABLED = 'false';
  process.env.AI_PROVIDER = 'openai';
  process.env.SAFETY_AGENT_ENABLED = 'true';
  process.env.SAFETY_AGENT_PROVIDER = 'openai';
  process.env.AI_BENCHMARK_MODE = 'true';
  process.env.AI_BENCHMARK_MAX_COST_USD = String(maxCostUsd);
  process.env.AI_COST_CEILING_ENFORCEMENT_ENABLED = 'false';
}

function benchmarkDatabaseUrl() {
  const value = process.env.AI_BENCHMARK_DATABASE_URL?.trim();
  if (!value) {
    throw new Error('AI_BENCHMARK_DATABASE_URL is required.');
  }
  const databaseName = new URL(value).pathname.replace(/^\//, '').toLowerCase();
  if (!databaseName.includes('benchmark') && !databaseName.includes('test')) {
    throw new Error('Benchmark database name must contain benchmark or test.');
  }
  if (value === process.env.DATABASE_URL) {
    throw new Error('Benchmark database must not equal DATABASE_URL.');
  }
  return value;
}

function requireOpenAiConfiguration(tiers: Tier[]) {
  const missing: string[] = [];
  if (!process.env.OPENAI_API_KEY?.trim()) missing.push('OPENAI_API_KEY');

  const hasDefaultModel = Boolean(process.env.OPENAI_DEFAULT_MODEL?.trim());
  const hasAllTierModels = ALL_TIERS.every((tier) =>
    readPreferredOrLegacy(
      `OPENAI_DAILY_PLAN_MODEL_${tier}`,
      legacyConfigForTier(tier).model
    )
  );
  if (!hasDefaultModel && !hasAllTierModels) {
    missing.push(
      'OPENAI_DEFAULT_MODEL or all OPENAI_DAILY_PLAN_MODEL_FREE/PLUS/PRO values'
    );
  }

  for (const tier of tiers) {
    const legacy = legacyConfigForTier(tier);
    if (
      !readPreferredOrLegacy(`OPENAI_DAILY_PLAN_MODEL_${tier}`, legacy.model)
    ) {
      missing.push(`OPENAI_DAILY_PLAN_MODEL_${tier}`);
    }
    if (
      !readPreferredOrLegacy(
        `OPENAI_DAILY_PLAN_${tier}_INPUT_COST_PER_1M_USD`,
        legacy.inputCost
      )
    ) {
      missing.push(`OPENAI_DAILY_PLAN_${tier}_INPUT_COST_PER_1M_USD`);
    }
    if (
      !readPreferredOrLegacy(
        `OPENAI_DAILY_PLAN_${tier}_OUTPUT_COST_PER_1M_USD`,
        legacy.outputCost
      )
    ) {
      missing.push(`OPENAI_DAILY_PLAN_${tier}_OUTPUT_COST_PER_1M_USD`);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing benchmark config: ${missing.join(', ')}`);
  }

  const invalidPrices = tiers.flatMap((tier) => {
    const legacy = legacyConfigForTier(tier);
    return [
      [`OPENAI_DAILY_PLAN_${tier}_INPUT_COST_PER_1M_USD`, legacy.inputCost],
      [`OPENAI_DAILY_PLAN_${tier}_OUTPUT_COST_PER_1M_USD`, legacy.outputCost]
    ].flatMap(([preferred, fallback]) => {
      const value = Number(readPreferredOrLegacy(preferred, fallback));
      return Number.isFinite(value) && value > 0 ? [] : [preferred];
    });
  });
  if (invalidPrices.length > 0) {
    throw new Error(
      `Benchmark prices must be positive: ${invalidPrices.join(', ')}`
    );
  }
}

function readPreferredOrLegacy(preferred: string, legacy: string) {
  return process.env[preferred]?.trim() || process.env[legacy]?.trim() || null;
}

function legacyConfigForTier(tier: Tier) {
  const route = routeForTier(tier);
  return {
    model: `OPENAI_MODEL_${route}`,
    inputCost: `OPENAI_${route}_INPUT_COST_PER_1M_USD`,
    outputCost: `OPENAI_${route}_OUTPUT_COST_PER_1M_USD`
  };
}

function configuredTiers(): Tier[] {
  const raw = process.env.AI_BENCHMARK_TIERS?.trim();
  if (!raw) return ALL_TIERS;

  const tiers = [
    ...new Set(raw.split(',').map((value) => value.trim().toUpperCase()))
  ];
  const invalid = tiers.filter((value) => !ALL_TIERS.includes(value as Tier));
  if (tiers.length === 0 || invalid.length > 0) {
    throw new Error(
      `AI_BENCHMARK_TIERS must contain only FREE, PLUS, or PRO. Invalid: ${invalid.join(', ') || 'empty'}.`
    );
  }
  return tiers as Tier[];
}

function routeForTier(tier: Tier) {
  if (tier === 'PRO') return 'SOL';
  if (tier === 'PLUS') return 'TERRA';
  return 'LUNA';
}

function expectedMenuOptionCount(tier: Tier) {
  if (tier === 'PRO') return 3;
  if (tier === 'PLUS') return 2;
  return 1;
}

async function registerUser(
  app: INestApplication,
  prisma: PrismaService,
  email: string,
  locale: BenchmarkLocale
) {
  await request(app.getHttpServer())
    .post('/v1/auth/register')
    .send({
      email,
      password: 'benchmark-password-123',
      timezone: 'UTC',
      locale,
      privacyConsentAccepted: true
    })
    .expect(201);
  await prisma.user.update({
    where: { email },
    data: { emailVerifiedAt: new Date() }
  });
  const login = await request(app.getHttpServer())
    .post('/v1/auth/login')
    .send({ email, password: 'benchmark-password-123' })
    .expect(201);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return {
    userId: user.id as string,
    accessToken: login.body.accessToken as string
  };
}

async function configureProfile(
  app: INestApplication,
  token: string,
  scenario: Scenario,
  index: number
) {
  const auth = { Authorization: `Bearer ${token}` };
  await request(app.getHttpServer())
    .put('/v1/profile')
    .set(auth)
    .send({
      firstName: `Benchmark${index}`,
      lastName: 'Synthetic',
      gender: index % 2 === 0 ? 'female' : 'male',
      pregnancyStatus: 'NOT_PREGNANT',
      dateOfBirth: '1990-01-01',
      heightCm: 170 + index,
      weightKg: 70 + index,
      activityLevel: 'MODERATE',
      privacyConsentAccepted: true
    })
    .expect(200);
  await request(app.getHttpServer())
    .put('/v1/goals')
    .set(auth)
    .send({
      goalType:
        scenario.appMode === 'NUTRITION_ONLY'
          ? 'HEALTHY_LIFESTYLE'
          : 'IMPROVE_FITNESS',
      appMode: scenario.appMode
    })
    .expect(200);
  await request(app.getHttpServer())
    .put('/v1/nutrition-preferences')
    .set(auth)
    .send({
      dietType: scenario.dietType,
      mealsPerDay: 3,
      allergies: scenario.allergies,
      noKnownAllergiesConfirmed: scenario.allergies.length === 0,
      excludedFoods: scenario.excludedFoods,
      preferredFoods: scenario.preferredFoods
    })
    .expect(200);
  if (scenario.appMode === 'NUTRITION_AND_TRAINING') {
    await request(app.getHttpServer())
      .post('/v1/training-schedule/items')
      .set(auth)
      .send({
        dayOfWeek: new Date().getUTCDay(),
        localTime: '18:00',
        sportType: 'STRENGTH',
        durationMinutes: 45,
        intensity: 'MODERATE',
        description: 'Full-body benchmark workout'
      })
      .expect(201);
  }
}

async function applyTier(prisma: PrismaService, userId: string, tier: Tier) {
  if (tier === 'FREE') return;
  const uniqueId = `${RUN_PREFIX}-${tier.toLowerCase()}-${userId}`;
  await prisma.subscription.create({
    data: {
      userId,
      plan: tier as SubscriptionPlan,
      status: SubscriptionStatus.ACTIVE,
      provider: SubscriptionProvider.DEV,
      environment: SubscriptionEnvironment.SANDBOX,
      providerCustomerId: uniqueId,
      providerSubscriptionId: uniqueId,
      providerTransactionId: uniqueId,
      originalTransactionId: uniqueId,
      providerProductId: `benchmark-${tier.toLowerCase()}`,
      startsAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 86_400_000)
    }
  });
}

function summarize(
  logs: BenchmarkRequestLog[],
  completedPlanGenerations: number
) {
  const estimatedCostMicrousd = logs.reduce(
    (total, log) => total + (log.estimatedCostMicrousd ?? 0),
    0
  );
  const estimatedCostUsd = estimatedCostMicrousd / 1_000_000;
  return {
    requestCount: logs.length,
    retryCount: logs.filter((log) => log.retryAttempt).length,
    successCount: logs.filter((log) => log.status === 'SUCCESS').length,
    errorCount: logs.filter((log) => log.status === 'ERROR').length,
    inputTokens: logs.reduce((total, log) => total + log.inputTokens, 0),
    outputTokens: logs.reduce((total, log) => total + log.outputTokens, 0),
    estimatedCostUsd,
    costPerCompletedPlanUsd:
      completedPlanGenerations > 0
        ? round(estimatedCostUsd / completedPlanGenerations, 6)
        : 0,
    averageLatencyMs: average(logs.map((log) => log.latencyMs)),
    p95LatencyMs: percentile(
      logs.map((log) => log.latencyMs),
      0.95
    ),
    routes: [...new Set(logs.map((log) => log.route))],
    models: [...new Set(logs.map((log) => log.model))],
    byRoute: summarizeGroups(logs, (log) => log.route),
    byAgent: summarizeGroups(logs, (log) => log.agent),
    byOperation: summarizeGroups(logs, (log) => log.operation)
  };
}

function summarizeGroups(
  logs: BenchmarkRequestLog[],
  keyFor: (log: BenchmarkRequestLog) => string
) {
  return Object.fromEntries(
    [...new Set(logs.map(keyFor))].sort().map((key) => {
      const group = logs.filter((log) => keyFor(log) === key);
      const estimatedCostMicrousd = group.reduce(
        (total, log) => total + (log.estimatedCostMicrousd ?? 0),
        0
      );
      const latencies = group.map((log) => log.latencyMs);
      return [
        key,
        {
          requestCount: group.length,
          retryCount: group.filter((log) => log.retryAttempt).length,
          errorCount: group.filter((log) => log.status === 'ERROR').length,
          inputTokens: group.reduce((total, log) => total + log.inputTokens, 0),
          outputTokens: group.reduce(
            (total, log) => total + log.outputTokens,
            0
          ),
          estimatedCostUsd: estimatedCostMicrousd / 1_000_000,
          averageLatencyMs: average(latencies),
          p95LatencyMs: percentile(latencies, 0.95)
        }
      ];
    })
  );
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(
    values.reduce((total, value) => total + value, 0) / values.length
  );
}

function percentile(values: number[], quantile: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * quantile) - 1] ?? 0;
}

function positiveInteger(key: string, fallback: number) {
  const value = Number(process.env[key]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function positiveNumber(key: string, fallback: number) {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function emitReport(value: unknown) {
  const reportPath = process.env.AI_BENCHMARK_REPORT_PATH?.trim();
  if (reportPath) {
    if (!reportPath.toLowerCase().endsWith('.json')) {
      throw new Error('AI_BENCHMARK_REPORT_PATH must end with .json.');
    }
    writeFileSync(resolve(reportPath), `${JSON.stringify(value, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'w'
    });
  }
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`AI live benchmark failed safely: ${message}\n`);
  process.exitCode = 1;
});
