import { AiModelRoute } from '@prisma/client';

import {
  evaluateAiQualityGate,
  type AiQualityGateConfig
} from './ai-quality-gate';
import type { AiQualityDistribution } from './ai-quality-report';

const config: AiQualityGateConfig = {
  sampleMinimum: 2,
  telemetryCoverageMinimumPercent: 95,
  readyRateMinimumPercent: 90,
  fallbackRateMaximumPercent: 5,
  retryRateMaximumPercent: 25
};

describe('evaluateAiQualityGate', () => {
  it('passes only when every route has representative quality telemetry', () => {
    const result = evaluateAiQualityGate(
      report(distribution()),
      config
    );

    expect(result.status).toBe('PASS');
    expect(result.tiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          route: AiModelRoute.LUNA,
          status: 'PASS'
        })
      ])
    );
  });

  it('fails when READY, fallback, or retry rates cross a guardrail', () => {
    const result = evaluateAiQualityGate(
      report(
        distribution({
          readyRatePercent: 80,
          fallbackRatePercent: 10,
          retryRatePercent: 30
        })
      ),
      config
    );

    expect(result.status).toBe('FAIL');
    expect(result.tiers[0]).toMatchObject({
      status: 'FAIL',
      reasons: [
        'ready_rate_below_minimum',
        'fallback_rate_above_maximum',
        'retry_rate_above_maximum'
      ]
    });
  });

  it('returns insufficient data instead of passing missing or legacy telemetry', () => {
    const result = evaluateAiQualityGate(
      {
        byRoute: {
          [AiModelRoute.LUNA]: distribution({
            sampleCount: 1,
            telemetryCoveragePercent: 50
          })
        }
      },
      config
    );

    expect(result.status).toBe('INSUFFICIENT_DATA');
    expect(result.tiers[0]).toMatchObject({
      status: 'INSUFFICIENT_DATA',
      reasons: [
        'sample_count_below_minimum',
        'telemetry_coverage_below_minimum'
      ]
    });
  });
});

function report(quality: AiQualityDistribution) {
  return {
    byRoute: {
      [AiModelRoute.LUNA]: quality,
      [AiModelRoute.TERRA]: quality,
      [AiModelRoute.SOL]: quality
    }
  };
}

function distribution(
  overrides: Partial<AiQualityDistribution> = {}
): AiQualityDistribution {
  return {
    operationCount: 10,
    observedOperationCount: 10,
    sampleCount: 2,
    telemetryCoveragePercent: 100,
    readyCount: 10,
    readyRatePercent: 100,
    fallbackCount: 0,
    fallbackRatePercent: 0,
    errorCount: 0,
    errorRatePercent: 0,
    retryOperationCount: 2,
    retryRatePercent: 20,
    ...overrides
  };
}
