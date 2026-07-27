import {
  AiModelRoute,
  SubscriptionPlan
} from '@prisma/client';

import type {
  AiCostCoverage,
  AiCostDistribution
} from './ai-cost-report';

export type AiUnitEconomicsStatus =
  | 'PASS'
  | 'FAIL'
  | 'INSUFFICIENT_DATA';

export interface AiUnitEconomicsConfig {
  sampleMinimum: number;
  pricedCoverageMinimumPercent: number;
  storefrontCommissionPercent: number;
  medianCostMaximumPercentNet: number;
  p95CostMaximumPercentNet: number;
  monthlyPriceUsd: Record<SubscriptionPlan, number>;
  monthlyCostCeilingUsd: Record<SubscriptionPlan, number | null>;
}

export interface AiUnitEconomicsReportInput {
  coverageByRoute: Partial<
    Record<AiModelRoute, AiCostCoverage>
  >;
  monthlyUserCostByRoute: Partial<
    Record<AiModelRoute, AiCostDistribution>
  >;
}

const ROUTE_BY_PLAN: Record<SubscriptionPlan, AiModelRoute> = {
  [SubscriptionPlan.FREE]: AiModelRoute.LUNA,
  [SubscriptionPlan.PLUS]: AiModelRoute.TERRA,
  [SubscriptionPlan.PRO]: AiModelRoute.SOL
};

export function evaluateAiUnitEconomics(
  report: AiUnitEconomicsReportInput,
  config: AiUnitEconomicsConfig
) {
  const tiers = Object.values(SubscriptionPlan).map((plan) =>
    evaluateTier(plan, report, config)
  );

  return {
    status: aggregateStatus(tiers.map((tier) => tier.status)),
    assumptions: {
      sampleMinimum: config.sampleMinimum,
      pricedCoverageMinimumPercent:
        config.pricedCoverageMinimumPercent,
      storefrontCommissionPercent:
        config.storefrontCommissionPercent,
      medianCostMaximumPercentNet:
        config.medianCostMaximumPercentNet,
      p95CostMaximumPercentNet:
        config.p95CostMaximumPercentNet
    },
    tiers
  };
}

function evaluateTier(
  plan: SubscriptionPlan,
  report: AiUnitEconomicsReportInput,
  config: AiUnitEconomicsConfig
) {
  const route = ROUTE_BY_PLAN[plan];
  const coverage = report.coverageByRoute[route] ?? {
    requestCount: 0,
    pricedRequestCount: 0,
    unpricedRequestCount: 0,
    pricedCoveragePercent: 0
  };
  const distribution = report.monthlyUserCostByRoute[route] ?? {
    sampleCount: 0,
    totalCostMicrousd: 0,
    medianCostMicrousd: 0,
    p95CostMicrousd: 0
  };
  const reasons: string[] = [];
  const monthlyPriceUsd = config.monthlyPriceUsd[plan];
  const netReceiptMicrousd = usdToMicrousd(
    monthlyPriceUsd *
      (1 - config.storefrontCommissionPercent / 100)
  );
  const ceilingUsd = config.monthlyCostCeilingUsd[plan];
  const ceilingMicrousd =
    ceilingUsd === null ? null : usdToMicrousd(ceilingUsd);

  if (distribution.sampleCount < config.sampleMinimum) {
    reasons.push('sample_count_below_minimum');
  }
  if (
    coverage.pricedCoveragePercent <
    config.pricedCoverageMinimumPercent
  ) {
    reasons.push('priced_coverage_below_minimum');
  }
  if (ceilingMicrousd === null) {
    reasons.push('monthly_cost_ceiling_not_configured');
  }

  const medianCostPercentNet =
    distribution.sampleCount === 0
      ? null
      : percentage(
          distribution.medianCostMicrousd,
          netReceiptMicrousd
        );
  const p95CostPercentNet =
    distribution.sampleCount === 0
      ? null
      : percentage(
          distribution.p95CostMicrousd,
          netReceiptMicrousd
        );
  const hasSufficientData = reasons.every(
    (reason) =>
      reason !== 'sample_count_below_minimum' &&
      reason !== 'priced_coverage_below_minimum' &&
      reason !== 'monthly_cost_ceiling_not_configured'
  );

  if (hasSufficientData && ceilingMicrousd !== null) {
    if (distribution.p95CostMicrousd > ceilingMicrousd) {
      reasons.push('p95_cost_exceeds_monthly_ceiling');
    }

    if (plan !== SubscriptionPlan.FREE) {
      if (
        medianCostPercentNet === null ||
        medianCostPercentNet >
          config.medianCostMaximumPercentNet
      ) {
        reasons.push('median_cost_exceeds_net_receipt_guardrail');
      }
      if (
        p95CostPercentNet === null ||
        p95CostPercentNet > config.p95CostMaximumPercentNet
      ) {
        reasons.push('p95_cost_exceeds_net_receipt_guardrail');
      }
    }
  }

  return {
    plan,
    route,
    status: !hasSufficientData
      ? ('INSUFFICIENT_DATA' as const)
      : reasons.length > 0
        ? ('FAIL' as const)
        : ('PASS' as const),
    reasons,
    sampleCount: distribution.sampleCount,
    requestCount: coverage.requestCount,
    pricedRequestCount: coverage.pricedRequestCount,
    pricedCoveragePercent: coverage.pricedCoveragePercent,
    monthlyPriceUsd,
    estimatedNetReceiptUsd: microusdToUsd(netReceiptMicrousd),
    monthlyCostCeilingUsd: ceilingUsd,
    medianCostUsd: microusdToUsd(
      distribution.medianCostMicrousd
    ),
    p95CostUsd: microusdToUsd(distribution.p95CostMicrousd),
    medianCostPercentNet,
    p95CostPercentNet
  };
}

function aggregateStatus(statuses: AiUnitEconomicsStatus[]) {
  if (statuses.includes('FAIL')) return 'FAIL' as const;
  if (statuses.includes('INSUFFICIENT_DATA')) {
    return 'INSUFFICIENT_DATA' as const;
  }
  return 'PASS' as const;
}

function percentage(value: number, total: number) {
  return total <= 0 ? null : round((value / total) * 100, 2);
}

function usdToMicrousd(value: number) {
  return Math.round(value * 1_000_000);
}

function microusdToUsd(value: number) {
  return round(value / 1_000_000, 6);
}

function round(value: number, decimals: number) {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

export function readAiUnitEconomicsConfig(
  env: NodeJS.ProcessEnv
): AiUnitEconomicsConfig {
  return {
    sampleMinimum: readPositiveInteger(
      env.AI_COST_MIN_TIER_SAMPLES,
      30
    ),
    pricedCoverageMinimumPercent: readPercentage(
      env.AI_COST_MIN_PRICED_COVERAGE_PERCENT,
      95
    ),
    storefrontCommissionPercent: readPercentage(
      env.AI_STOREFRONT_COMMISSION_PERCENT,
      20
    ),
    medianCostMaximumPercentNet: readPercentage(
      env.AI_MEDIAN_COST_MAX_PERCENT_NET,
      15
    ),
    p95CostMaximumPercentNet: readPercentage(
      env.AI_P95_COST_MAX_PERCENT_NET,
      25
    ),
    monthlyPriceUsd: {
      [SubscriptionPlan.FREE]: 0,
      [SubscriptionPlan.PLUS]: readPositiveNumber(
        env.AI_PRICE_PLUS_MONTHLY_USD,
        19.99
      ),
      [SubscriptionPlan.PRO]: readPositiveNumber(
        env.AI_PRICE_PRO_MONTHLY_USD,
        39.99
      )
    },
    monthlyCostCeilingUsd: {
      [SubscriptionPlan.FREE]: readOptionalPositiveNumber(
        env.AI_MONTHLY_COST_CEILING_FREE_USD
      ),
      [SubscriptionPlan.PLUS]: readOptionalPositiveNumber(
        env.AI_MONTHLY_COST_CEILING_PLUS_USD
      ),
      [SubscriptionPlan.PRO]: readOptionalPositiveNumber(
        env.AI_MONTHLY_COST_CEILING_PRO_USD
      )
    }
  };
}

function readPositiveInteger(
  raw: string | undefined,
  fallback: number
) {
  return Math.trunc(readPositiveNumber(raw, fallback));
}

function readPercentage(
  raw: string | undefined,
  fallback: number
) {
  const value = readPositiveNumber(raw, fallback);
  if (value > 100) {
    throw new Error('Percentage configuration must be at most 100.');
  }
  return value;
}

function readPositiveNumber(
  raw: string | undefined,
  fallback: number
) {
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('AI unit-economics configuration must be positive.');
  }
  return value;
}

function readOptionalPositiveNumber(raw: string | undefined) {
  if (raw === undefined || raw.trim() === '') return null;
  return readPositiveNumber(raw, 0);
}
