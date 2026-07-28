import {
  AiModelRoute,
  SubscriptionPlan
} from '@prisma/client';

import type { AiQualityDistribution } from './ai-quality-report';

export type AiQualityGateStatus =
  | 'PASS'
  | 'FAIL'
  | 'INSUFFICIENT_DATA';

export interface AiQualityGateConfig {
  sampleMinimum: number;
  telemetryCoverageMinimumPercent: number;
  readyRateMinimumPercent: number;
  fallbackRateMaximumPercent: number;
  retryRateMaximumPercent: number;
}

export interface AiQualityGateReportInput {
  byRoute: Partial<Record<AiModelRoute, AiQualityDistribution>>;
}

const ROUTE_BY_PLAN: Record<SubscriptionPlan, AiModelRoute> = {
  [SubscriptionPlan.FREE]: AiModelRoute.LUNA,
  [SubscriptionPlan.PLUS]: AiModelRoute.TERRA,
  [SubscriptionPlan.PRO]: AiModelRoute.SOL
};

export function evaluateAiQualityGate(
  report: AiQualityGateReportInput,
  config: AiQualityGateConfig
) {
  const tiers = Object.values(SubscriptionPlan).map((plan) =>
    evaluateTier(plan, report, config)
  );

  return {
    status: aggregateStatus(tiers.map((tier) => tier.status)),
    assumptions: config,
    tiers
  };
}

function evaluateTier(
  plan: SubscriptionPlan,
  report: AiQualityGateReportInput,
  config: AiQualityGateConfig
) {
  const route = ROUTE_BY_PLAN[plan];
  const quality = report.byRoute[route] ?? emptyDistribution();
  const insufficientReasons: string[] = [];

  if (quality.sampleCount < config.sampleMinimum) {
    insufficientReasons.push('sample_count_below_minimum');
  }
  if (
    quality.telemetryCoveragePercent <
    config.telemetryCoverageMinimumPercent
  ) {
    insufficientReasons.push('telemetry_coverage_below_minimum');
  }

  if (insufficientReasons.length > 0) {
    return {
      plan,
      route,
      status: 'INSUFFICIENT_DATA' as const,
      reasons: insufficientReasons,
      ...quality
    };
  }

  const reasons: string[] = [];
  if (quality.readyRatePercent < config.readyRateMinimumPercent) {
    reasons.push('ready_rate_below_minimum');
  }
  if (
    quality.fallbackRatePercent >
    config.fallbackRateMaximumPercent
  ) {
    reasons.push('fallback_rate_above_maximum');
  }
  if (quality.retryRatePercent > config.retryRateMaximumPercent) {
    reasons.push('retry_rate_above_maximum');
  }

  return {
    plan,
    route,
    status: reasons.length > 0 ? ('FAIL' as const) : ('PASS' as const),
    reasons,
    ...quality
  };
}

function emptyDistribution(): AiQualityDistribution {
  return {
    operationCount: 0,
    observedOperationCount: 0,
    sampleCount: 0,
    telemetryCoveragePercent: 0,
    readyCount: 0,
    readyRatePercent: 0,
    fallbackCount: 0,
    fallbackRatePercent: 0,
    errorCount: 0,
    errorRatePercent: 0,
    retryOperationCount: 0,
    retryRatePercent: 0
  };
}

function aggregateStatus(statuses: AiQualityGateStatus[]) {
  if (statuses.includes('FAIL')) return 'FAIL' as const;
  if (statuses.includes('INSUFFICIENT_DATA')) {
    return 'INSUFFICIENT_DATA' as const;
  }
  return 'PASS' as const;
}

export function readAiQualityGateConfig(
  env: NodeJS.ProcessEnv
): AiQualityGateConfig {
  return {
    sampleMinimum: readPositiveInteger(
      env.AI_QUALITY_MIN_TIER_SAMPLES,
      30
    ),
    telemetryCoverageMinimumPercent: readPercentage(
      env.AI_QUALITY_MIN_TELEMETRY_COVERAGE_PERCENT,
      95
    ),
    readyRateMinimumPercent: readPercentage(
      env.AI_QUALITY_MIN_READY_RATE_PERCENT,
      98
    ),
    fallbackRateMaximumPercent: readPercentage(
      env.AI_QUALITY_MAX_FALLBACK_RATE_PERCENT,
      2
    ),
    retryRateMaximumPercent: readPercentage(
      env.AI_QUALITY_MAX_RETRY_RATE_PERCENT,
      25
    )
  };
}

function readPositiveInteger(
  raw: string | undefined,
  fallback: number
) {
  const value = readNumber(raw, fallback);
  if (value <= 0) {
    throw new Error('AI quality sample minimum must be positive.');
  }
  return Math.trunc(value);
}

function readPercentage(
  raw: string | undefined,
  fallback: number
) {
  const value = readNumber(raw, fallback);
  if (value < 0 || value > 100) {
    throw new Error(
      'AI quality percentage configuration must be between 0 and 100.'
    );
  }
  return value;
}

function readNumber(raw: string | undefined, fallback: number) {
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error('AI quality configuration must be numeric.');
  }
  return value;
}
