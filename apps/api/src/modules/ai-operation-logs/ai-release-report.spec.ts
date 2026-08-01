import {
  AiModelRoute,
  AiOperationStatus,
  AiRequestAgent,
  AiRequestOperation,
  PlanQualityMode,
  PlanStatus
} from '@prisma/client';

import { buildAiReleaseReport } from './ai-release-report';

describe('AI release report', () => {
  it('builds a versioned aggregate snapshot without user identifiers', () => {
    const report = buildAiReleaseReport({
      requestRows: [
        {
          userId: 'private-user-id',
          route: AiModelRoute.LUNA,
          agent: AiRequestAgent.DAILY_PLAN,
          operation: AiRequestOperation.DAILY_PLAN_GENERATION,
          estimatedCostMicrousd: 20_000
        }
      ],
      operationRows: [
        {
          userId: 'private-user-id',
          route: AiModelRoute.LUNA,
          planQualityMode: PlanQualityMode.BASIC,
          status: AiOperationStatus.SUCCESS,
          finalPlanStatus: PlanStatus.READY,
          retryCount: 0
        }
      ],
      periodDays: 30,
      since: new Date('2026-07-01T00:00:00.000Z'),
      generatedAt: new Date('2026-08-01T00:00:00.000Z'),
      environment: economicsEnvironment()
    });

    expect(report).toMatchObject({
      reportSchemaVersion: 'ai-release-monitor.v1',
      periodDays: 30,
      status: 'INSUFFICIENT_DATA',
      summary: {
        requestCount: 1,
        operationCount: 1,
        unitEconomicsStatus: 'INSUFFICIENT_DATA',
        qualityGateStatus: 'INSUFFICIENT_DATA'
      }
    });
    expect(JSON.stringify(report)).not.toContain('private-user-id');
  });

  it('does not treat an empty synthetic environment as release-ready', () => {
    const report = buildAiReleaseReport({
      requestRows: [],
      operationRows: [],
      periodDays: 30,
      since: new Date('2026-07-01T00:00:00.000Z'),
      generatedAt: new Date('2026-08-01T00:00:00.000Z'),
      environment: economicsEnvironment()
    });

    expect(report.status).toBe('INSUFFICIENT_DATA');
    expect(report.summary.tiers).toHaveLength(3);
    expect(
      report.summary.tiers.every(
        (tier) => tier.qualityStatus === 'INSUFFICIENT_DATA'
      )
    ).toBe(true);
  });
});

function economicsEnvironment(): NodeJS.ProcessEnv {
  return {
    AI_COST_MIN_TIER_SAMPLES: '30',
    AI_COST_MIN_PRICED_COVERAGE_PERCENT: '95',
    AI_STOREFRONT_COMMISSION_PERCENT: '20',
    AI_MEDIAN_COST_MAX_PERCENT_NET: '15',
    AI_P95_COST_MAX_PERCENT_NET: '25',
    AI_PRICE_PLUS_MONTHLY_USD: '19.99',
    AI_PRICE_PRO_MONTHLY_USD: '39.99',
    AI_MONTHLY_COST_CEILING_FREE_USD: '1.50',
    AI_MONTHLY_COST_CEILING_PLUS_USD: '4.00',
    AI_MONTHLY_COST_CEILING_PRO_USD: '8.00',
    AI_QUALITY_MIN_TIER_SAMPLES: '30',
    AI_QUALITY_MIN_TELEMETRY_COVERAGE_PERCENT: '95',
    AI_QUALITY_MIN_READY_RATE_PERCENT: '98',
    AI_QUALITY_MAX_FALLBACK_RATE_PERCENT: '2',
    AI_QUALITY_MAX_RETRY_RATE_PERCENT: '25'
  };
}
