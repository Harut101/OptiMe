import {
  AiModelRoute,
  SubscriptionPlan
} from '@prisma/client';

import {
  evaluateAiUnitEconomics,
  type AiUnitEconomicsConfig
} from './ai-unit-economics';

const config: AiUnitEconomicsConfig = {
  sampleMinimum: 2,
  pricedCoverageMinimumPercent: 95,
  storefrontCommissionPercent: 20,
  medianCostMaximumPercentNet: 15,
  p95CostMaximumPercentNet: 25,
  monthlyPriceUsd: {
    [SubscriptionPlan.FREE]: 0,
    [SubscriptionPlan.PLUS]: 19.99,
    [SubscriptionPlan.PRO]: 39.99
  },
  monthlyCostCeilingUsd: {
    [SubscriptionPlan.FREE]: 0.5,
    [SubscriptionPlan.PLUS]: 3,
    [SubscriptionPlan.PRO]: 6
  }
};

describe('evaluateAiUnitEconomics', () => {
  it('passes representative tier costs inside all guardrails', () => {
    const result = evaluateAiUnitEconomics(
      report({
        luna: [200_000, 300_000],
        terra: [1_000_000, 2_000_000],
        sol: [3_000_000, 5_000_000]
      }),
      config
    );

    expect(result.status).toBe('PASS');
    expect(result.tiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          plan: SubscriptionPlan.PLUS,
          status: 'PASS',
          medianCostPercentNet: 6.25,
          p95CostPercentNet: 12.51
        })
      ])
    );
    expect(JSON.stringify(result)).not.toContain('userId');
  });

  it('fails when paid p95 cost exceeds net-receipt guardrails', () => {
    const result = evaluateAiUnitEconomics(
      report({
        luna: [200_000, 300_000],
        terra: [1_000_000, 5_000_000],
        sol: [3_000_000, 5_000_000]
      }),
      config
    );
    const plus = result.tiers.find(
      (tier) => tier.plan === SubscriptionPlan.PLUS
    );

    expect(result.status).toBe('FAIL');
    expect(plus).toMatchObject({
      status: 'FAIL',
      reasons: expect.arrayContaining([
        'p95_cost_exceeds_monthly_ceiling',
        'p95_cost_exceeds_net_receipt_guardrail'
      ])
    });
  });

  it('returns insufficient data instead of a false green result', () => {
    const result = evaluateAiUnitEconomics(
      {
        coverageByRoute: {
          [AiModelRoute.LUNA]: coverage(1, 0)
        },
        monthlyUserCostByRoute: {}
      },
      {
        ...config,
        monthlyCostCeilingUsd: {
          ...config.monthlyCostCeilingUsd,
          [SubscriptionPlan.PRO]: null
        }
      }
    );

    expect(result.status).toBe('INSUFFICIENT_DATA');
    expect(result.tiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          plan: SubscriptionPlan.PRO,
          status: 'INSUFFICIENT_DATA',
          reasons: expect.arrayContaining([
            'sample_count_below_minimum',
            'priced_coverage_below_minimum',
            'monthly_cost_ceiling_not_configured'
          ])
        })
      ])
    );
  });
});

function report(input: {
  luna: [number, number];
  terra: [number, number];
  sol: [number, number];
}) {
  return {
    coverageByRoute: {
      [AiModelRoute.LUNA]: coverage(10, 10),
      [AiModelRoute.TERRA]: coverage(10, 10),
      [AiModelRoute.SOL]: coverage(10, 10)
    },
    monthlyUserCostByRoute: {
      [AiModelRoute.LUNA]: distribution(input.luna),
      [AiModelRoute.TERRA]: distribution(input.terra),
      [AiModelRoute.SOL]: distribution(input.sol)
    }
  };
}

function coverage(requestCount: number, pricedRequestCount: number) {
  return {
    requestCount,
    pricedRequestCount,
    unpricedRequestCount: requestCount - pricedRequestCount,
    pricedCoveragePercent:
      requestCount === 0
        ? 0
        : (pricedRequestCount / requestCount) * 100
  };
}

function distribution([median, p95]: [number, number]) {
  return {
    sampleCount: 2,
    totalCostMicrousd: median + p95,
    medianCostMicrousd: median,
    p95CostMicrousd: p95
  };
}
