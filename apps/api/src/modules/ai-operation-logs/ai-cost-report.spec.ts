import {
  AiModelRoute,
  AiRequestAgent,
  AiRequestOperation
} from '@prisma/client';

import { buildAiCostReport } from './ai-cost-report';

describe('buildAiCostReport', () => {
  it('reports request and per-user median/p95 cost without exposing user IDs', () => {
    const report = buildAiCostReport([
      row('user-1', 100),
      row('user-1', 200),
      row('user-2', 900),
      row('user-3', null)
    ]);

    expect(report).toMatchObject({
      requestCount: 4,
      pricedRequestCount: 3,
      unpricedRequestCount: 1,
      overall: {
        sampleCount: 3,
        totalCostMicrousd: 1_200,
        medianCostMicrousd: 200,
        p95CostMicrousd: 900
      },
      monthlyUserCostByRoute: {
        LUNA: {
          sampleCount: 2,
          totalCostMicrousd: 1_200,
          medianCostMicrousd: 300,
          p95CostMicrousd: 900
        }
      }
    });
    expect(JSON.stringify(report)).not.toContain('user-1');
  });
});

function row(userId: string, estimatedCostMicrousd: number | null) {
  return {
    userId,
    route: AiModelRoute.LUNA,
    agent: AiRequestAgent.DAILY_PLAN,
    operation: AiRequestOperation.DAILY_PLAN_GENERATION,
    estimatedCostMicrousd
  };
}
