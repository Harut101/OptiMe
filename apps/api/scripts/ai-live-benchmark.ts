import type { INestApplication } from '@nestjs/common';
import {
  SubscriptionEnvironment,
  SubscriptionPlan,
  SubscriptionProvider,
  SubscriptionStatus
} from '@prisma/client';
import request from 'supertest';

import type { PrismaService } from '../src/prisma/prisma.service';

const HARD_MAX_COST_USD = 10;
const RUN_PREFIX = `ai-benchmark-${Date.now()}`;
type Tier = 'FREE' | 'PLUS' | 'PRO';

interface Scenario {
  suffix: string;
  appMode: 'NUTRITION_ONLY' | 'NUTRITION_AND_TRAINING';
  dietType: 'OMNIVORE' | 'VEGETARIAN';
  allergies: string[];
  excludedFoods: string[];
  preferredFoods: string[];
}

interface BenchmarkRequestLog {
  route: string;
  model: string;
  status: string;
  retryAttempt: boolean;
  inputTokens: number;
  outputTokens: number;
  estimatedCostMicrousd: number | null;
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
  if (process.env.AI_BENCHMARK_REAL_CALLS_ENABLED !== 'true') {
    print({
      mode: 'dry-run',
      realCallsEnabled: false,
      tiers: ['FREE', 'PLUS', 'PRO'],
      profilesPerTier,
      plannedPlanGenerations: profilesPerTier * 3,
      hardMaxCostUsd: HARD_MAX_COST_USD,
      configuredMaxCostUsd: maxCostUsd,
      message: 'No OpenAI calls were made.'
    });
    return;
  }

  const databaseUrl = benchmarkDatabaseUrl();
  requireOpenAiConfiguration();
  configureRun(databaseUrl, maxCostUsd);

  const [{ createTestApp }, foodSeed, exerciseSeed, budgetModule] =
    await Promise.all([
      import('../test/helpers/test-app'),
      import('../prisma/seeds/foods/seed'),
      import('../prisma/seeds/exercises/seed'),
      import(
        '../src/modules/ai-operation-logs/ai-benchmark-budget.service'
      )
    ]);
  const ctx = await createTestApp();
  const budget = ctx.app.get(budgetModule.AiBenchmarkBudgetService);
  const userIds: string[] = [];
  const outcomes: Array<{
    tier: Tier;
    scenario: string;
    status: string;
    fallbackReason: string | null;
  }> = [];
  const startedAt = new Date();

  try {
    await foodSeed.seedFoodCatalog(ctx.prisma);
    await exerciseSeed.seedExerciseCatalog(ctx.prisma);

    benchmarkLoop: for (const tier of ['FREE', 'PLUS', 'PRO'] as const) {
      for (let index = 0; index < profilesPerTier; index += 1) {
        if (budget.snapshot().exhausted) break benchmarkLoop;
        const scenario = scenarios[index % scenarios.length];
        const user = await registerUser(
          ctx.app,
          ctx.prisma,
          `${RUN_PREFIX}-${tier.toLowerCase()}-${index}@example.test`
        );
        userIds.push(user.userId);
        await configureProfile(ctx.app, user.accessToken, scenario, index);
        await applyTier(ctx.prisma, user.userId, tier);

        const response = await request(ctx.app.getHttpServer())
          .post('/v1/daily-plans/generate')
          .set('Authorization', `Bearer ${user.accessToken}`)
          .send({ forceRegenerate: false });
        const fallbackReason = response.body?.plan?.debug?.fallbackReason;
        outcomes.push({
          tier,
          scenario: scenario.suffix,
          status:
            typeof response.body?.status === 'string'
              ? response.body.status
              : `HTTP_${response.status}`,
          fallbackReason:
            typeof fallbackReason === 'string' ? fallbackReason : null
        });
      }
    }

    const logs = await ctx.prisma.aiRequestLog.findMany({
      where: { userId: { in: userIds }, createdAt: { gte: startedAt } },
      select: {
        route: true,
        model: true,
        status: true,
        retryAttempt: true,
        inputTokens: true,
        outputTokens: true,
        estimatedCostMicrousd: true
      }
    });
    print({
      mode: 'real',
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
      telemetry: summarize(logs)
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
    throw new Error(
      'Benchmark database name must contain benchmark or test.'
    );
  }
  if (value === process.env.DATABASE_URL) {
    throw new Error('Benchmark database must not equal DATABASE_URL.');
  }
  return value;
}

function requireOpenAiConfiguration() {
  const required = [
    'OPENAI_API_KEY',
    'OPENAI_DEFAULT_MODEL',
    'OPENAI_MODEL_LUNA',
    'OPENAI_MODEL_TERRA',
    'OPENAI_MODEL_SOL',
    'OPENAI_LUNA_INPUT_COST_PER_1M_USD',
    'OPENAI_LUNA_OUTPUT_COST_PER_1M_USD',
    'OPENAI_TERRA_INPUT_COST_PER_1M_USD',
    'OPENAI_TERRA_OUTPUT_COST_PER_1M_USD',
    'OPENAI_SOL_INPUT_COST_PER_1M_USD',
    'OPENAI_SOL_OUTPUT_COST_PER_1M_USD'
  ];
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing benchmark config: ${missing.join(', ')}`);
  }
  const invalidPrices = required
    .filter((key) => key.endsWith('_COST_PER_1M_USD'))
    .filter((key) => {
      const value = Number(process.env[key]);
      return !Number.isFinite(value) || value <= 0;
    });
  if (invalidPrices.length > 0) {
    throw new Error(
      `Benchmark prices must be positive: ${invalidPrices.join(', ')}`
    );
  }
}

async function registerUser(
  app: INestApplication,
  prisma: PrismaService,
  email: string
) {
  await request(app.getHttpServer())
    .post('/v1/auth/register')
    .send({
      email,
      password: 'benchmark-password-123',
      timezone: 'UTC',
      locale: 'en-US',
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
  return { userId: user.id as string, accessToken: login.body.accessToken as string };
}

async function configureProfile(
  app: INestApplication,
  token: string,
  scenario: Scenario,
  index: number
) {
  const auth = { Authorization: `Bearer ${token}` };
  await request(app.getHttpServer()).put('/v1/profile').set(auth).send({
    firstName: `Benchmark${index}`,
    lastName: 'Synthetic',
    gender: index % 2 === 0 ? 'female' : 'male',
    pregnancyStatus: 'NOT_PREGNANT',
    dateOfBirth: '1990-01-01',
    heightCm: 170 + index,
    weightKg: 70 + index,
    activityLevel: 'MODERATE',
    privacyConsentAccepted: true
  }).expect(200);
  await request(app.getHttpServer()).put('/v1/goals').set(auth).send({
    goalType:
      scenario.appMode === 'NUTRITION_ONLY'
        ? 'HEALTHY_LIFESTYLE'
        : 'IMPROVE_FITNESS',
    appMode: scenario.appMode
  }).expect(200);
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

async function applyTier(
  prisma: PrismaService,
  userId: string,
  tier: Tier
) {
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

function summarize(logs: BenchmarkRequestLog[]) {
  const estimatedCostMicrousd = logs.reduce(
    (total, log) => total + (log.estimatedCostMicrousd ?? 0),
    0
  );
  const routeSummaries = Object.fromEntries(
    [...new Set(logs.map((log) => log.route))].map((route) => {
      const routeLogs = logs.filter((log) => log.route === route);
      const routeCostMicrousd = routeLogs.reduce(
        (total, log) => total + (log.estimatedCostMicrousd ?? 0),
        0
      );
      return [
        route,
        {
          requestCount: routeLogs.length,
          retryCount: routeLogs.filter((log) => log.retryAttempt).length,
          errorCount: routeLogs.filter((log) => log.status === 'ERROR').length,
          inputTokens: routeLogs.reduce(
            (total, log) => total + log.inputTokens,
            0
          ),
          outputTokens: routeLogs.reduce(
            (total, log) => total + log.outputTokens,
            0
          ),
          estimatedCostUsd: routeCostMicrousd / 1_000_000
        }
      ];
    })
  );
  return {
    requestCount: logs.length,
    retryCount: logs.filter((log) => log.retryAttempt).length,
    successCount: logs.filter((log) => log.status === 'SUCCESS').length,
    errorCount: logs.filter((log) => log.status === 'ERROR').length,
    inputTokens: logs.reduce((total, log) => total + log.inputTokens, 0),
    outputTokens: logs.reduce((total, log) => total + log.outputTokens, 0),
    estimatedCostUsd: estimatedCostMicrousd / 1_000_000,
    routes: [...new Set(logs.map((log) => log.route))],
    models: [...new Set(logs.map((log) => log.model))],
    byRoute: routeSummaries
  };
}

function positiveInteger(key: string, fallback: number) {
  const value = Number(process.env[key]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function positiveNumber(key: string, fallback: number) {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function print(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`AI live benchmark failed safely: ${message}\n`);
  process.exitCode = 1;
});
