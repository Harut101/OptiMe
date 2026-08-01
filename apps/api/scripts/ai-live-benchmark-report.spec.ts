import {
  assertComparableBenchmarkReport,
  compareBenchmarkReports,
  parseBenchmarkReportPaths,
  type ComparableBenchmarkReport
} from './ai-live-benchmark-report';

describe('AI live benchmark report comparison', () => {
  it('reports quality, retry, token, and cost deltas', () => {
    const baseline = createReport();
    const current = createReport({
      flowLabel: 'nutrition-agent-authoritative-v1',
      qualityScore: 99,
      contractPasses: 6,
      retryCount: 1,
      inputTokens: 8_000,
      outputTokens: 4_000,
      costPerPlan: 0.08
    });

    const comparison = compareBenchmarkReports(baseline, current);

    expect(comparison.deltas.overallQualityScore).toBe(1);
    expect(comparison.deltas.retryCount).toBe(-1);
    expect(comparison.deltas.inputTokens).toBe(-2_000);
    expect(comparison.deltas.outputTokens).toBe(-2_000);
    expect(comparison.deltas.costPerCompletedPlanUsd).toBe(-0.02);
    expect(comparison.gates).toEqual({
      comparableSampleSize: true,
      noQualityRegression: true,
      noContractRegression: true,
      noFallbackRegression: true,
      noDegradedReadyRegression: true
    });
  });

  it('flags quality and contract regressions', () => {
    const comparison = compareBenchmarkReports(
      createReport(),
      createReport({ qualityScore: 94, contractPasses: 4 })
    );

    expect(comparison.gates.noQualityRegression).toBe(false);
    expect(comparison.gates.noContractRegression).toBe(false);
  });

  it('rejects unversioned input', () => {
    expect(() =>
      assertComparableBenchmarkReport({}, 'Baseline report')
    ).toThrow('Baseline report is not an ai-live-benchmark.v2 report.');
  });

  it('does not pass quality or sample gates without comparable data', () => {
    const baseline = createReport();
    const current = createReport({ qualityScore: null, planCount: 4 });

    const comparison = compareBenchmarkReports(baseline, current);

    expect(comparison.gates.comparableSampleSize).toBe(false);
    expect(comparison.gates.noQualityRegression).toBe(false);
  });

  it('accepts the pnpm argument separator before report paths', () => {
    expect(
      parseBenchmarkReportPaths(['--', 'baseline.json', 'current.json'])
    ).toEqual({
      baselinePath: 'baseline.json',
      currentPath: 'current.json'
    });
  });
});

function createReport(
  overrides: {
    flowLabel?: string;
    qualityScore?: number | null;
    planCount?: number;
    contractPasses?: number;
    retryCount?: number;
    inputTokens?: number;
    outputTokens?: number;
    costPerPlan?: number;
  } = {}
): ComparableBenchmarkReport {
  return {
    reportSchemaVersion: 'ai-live-benchmark.v2',
    flowLabel: overrides.flowLabel ?? 'legacy-combined-planner',
    label: 'test-model',
    completedPlanGenerations: overrides.planCount ?? 6,
    readyPlans: overrides.planCount ?? 6,
    degradedReadyPlans: 0,
    fallbackPlans: 0,
    quality: {
      averageOverallScore:
        overrides.qualityScore === undefined ? 98 : overrides.qualityScore,
      contract: {
        passedPlanCount: overrides.contractPasses ?? 6,
        failedPlanCount: 6 - (overrides.contractPasses ?? 6)
      },
      food: { averageScore: 98, deterministicFallbackCount: 0 },
      training: {
        averageScore: 98,
        aiRetryCount: 0,
        deterministicFallbackCount: 0
      }
    },
    telemetry: {
      requestCount: 18,
      retryCount: overrides.retryCount ?? 2,
      inputTokens: overrides.inputTokens ?? 10_000,
      outputTokens: overrides.outputTokens ?? 6_000,
      estimatedCostUsd: 0.6,
      costPerCompletedPlanUsd: overrides.costPerPlan ?? 0.1,
      averageLatencyMs: 10_000,
      p95LatencyMs: 20_000
    }
  };
}
