import {
  AiModelRoute,
  AiOperationStatus,
  PlanQualityMode,
  PlanStatus
} from '@prisma/client';

import { buildAiQualityReport } from './ai-quality-report';

describe('buildAiQualityReport', () => {
  it('reports READY, fallback, error, retry, and telemetry coverage without user IDs', () => {
    const report = buildAiQualityReport([
      row('user-1', PlanStatus.READY, 0),
      row('user-2', PlanStatus.READY, 1),
      row('user-3', PlanStatus.FALLBACK, 0),
      row('user-4', null, 0, AiOperationStatus.ERROR),
      row(
        'user-5',
        PlanStatus.READY,
        0,
        AiOperationStatus.FALLBACK
      ),
      {
        ...row('legacy-user', null, 0),
        route: null,
        planQualityMode: null
      }
    ]);

    expect(report).toMatchObject({
      operationCount: 6,
      attributedOperationCount: 5,
      unattributedOperationCount: 1,
      routeCoveragePercent: 83.33,
      byRoute: {
        LUNA: {
          operationCount: 5,
          observedOperationCount: 5,
          sampleCount: 5,
          telemetryCoveragePercent: 100,
          readyCount: 3,
          readyRatePercent: 60,
          fallbackCount: 2,
          fallbackRatePercent: 40,
          errorCount: 1,
          errorRatePercent: 20,
          retryOperationCount: 1,
          retryRatePercent: 20
        }
      }
    });
    expect(JSON.stringify(report)).not.toContain('user-1');
  });

  it('keeps legacy rows visible as missing telemetry instead of treating them as READY', () => {
    const report = buildAiQualityReport([
      row('user-1', PlanStatus.READY, 0),
      row('user-2', null, 0)
    ]);

    expect(report.byRoute[AiModelRoute.LUNA]).toMatchObject({
      operationCount: 2,
      observedOperationCount: 1,
      telemetryCoveragePercent: 50,
      readyRatePercent: 100
    });
  });
});

function row(
  userId: string,
  finalPlanStatus: PlanStatus | null,
  retryCount: number,
  status: AiOperationStatus = AiOperationStatus.SUCCESS
) {
  return {
    userId,
    route: AiModelRoute.LUNA,
    planQualityMode: PlanQualityMode.BASIC,
    status,
    finalPlanStatus,
    retryCount
  };
}
