export interface ComparableBenchmarkReport {
  reportSchemaVersion: 'ai-live-benchmark.v2';
  flowLabel: string;
  label: string | null;
  completedPlanGenerations: number;
  readyPlans: number;
  degradedReadyPlans: number;
  fallbackPlans: number;
  quality: {
    averageOverallScore: number | null;
    contract: {
      passedPlanCount: number;
      failedPlanCount: number;
    };
    food: {
      averageScore: number | null;
      deterministicFallbackCount: number;
    };
    training: {
      averageScore: number | null;
      aiRetryCount: number;
      deterministicFallbackCount: number;
    };
  };
  telemetry: {
    requestCount: number;
    retryCount: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
    costPerCompletedPlanUsd: number;
    averageLatencyMs: number;
    p95LatencyMs: number;
  };
}

export function compareBenchmarkReports(
  baseline: ComparableBenchmarkReport,
  current: ComparableBenchmarkReport
) {
  const baselineContractRate = rate(
    baseline.quality.contract.passedPlanCount,
    baseline.completedPlanGenerations
  );
  const currentContractRate = rate(
    current.quality.contract.passedPlanCount,
    current.completedPlanGenerations
  );
  const qualityDelta = nullableDelta(
    baseline.quality.averageOverallScore,
    current.quality.averageOverallScore
  );

  return {
    reportSchemaVersion: 'ai-live-benchmark-comparison.v1',
    baseline: identify(baseline),
    current: identify(current),
    sampleSizeComparable:
      baseline.completedPlanGenerations === current.completedPlanGenerations,
    deltas: {
      readyPlans: current.readyPlans - baseline.readyPlans,
      degradedReadyPlans:
        current.degradedReadyPlans - baseline.degradedReadyPlans,
      fallbackPlans: current.fallbackPlans - baseline.fallbackPlans,
      overallQualityScore: qualityDelta,
      contractPassRatePercentagePoints: round(
        currentContractRate - baselineContractRate
      ),
      foodScore: nullableDelta(
        baseline.quality.food.averageScore,
        current.quality.food.averageScore
      ),
      trainingScore: nullableDelta(
        baseline.quality.training.averageScore,
        current.quality.training.averageScore
      ),
      requestCount:
        current.telemetry.requestCount - baseline.telemetry.requestCount,
      retryCount: current.telemetry.retryCount - baseline.telemetry.retryCount,
      inputTokens:
        current.telemetry.inputTokens - baseline.telemetry.inputTokens,
      outputTokens:
        current.telemetry.outputTokens - baseline.telemetry.outputTokens,
      costPerCompletedPlanUsd: round(
        current.telemetry.costPerCompletedPlanUsd -
          baseline.telemetry.costPerCompletedPlanUsd,
        6
      ),
      averageLatencyMs:
        current.telemetry.averageLatencyMs -
        baseline.telemetry.averageLatencyMs,
      p95LatencyMs:
        current.telemetry.p95LatencyMs - baseline.telemetry.p95LatencyMs
    },
    gates: {
      comparableSampleSize:
        baseline.completedPlanGenerations === current.completedPlanGenerations,
      noQualityRegression: qualityDelta !== null && qualityDelta >= -2,
      noContractRegression: currentContractRate >= baselineContractRate,
      noFallbackRegression: current.fallbackPlans <= baseline.fallbackPlans,
      noDegradedReadyRegression:
        current.degradedReadyPlans <= baseline.degradedReadyPlans
    }
  };
}

export function assertComparableBenchmarkReport(
  value: unknown,
  source: string
): asserts value is ComparableBenchmarkReport {
  const report = asRecord(value);
  const quality = asRecord(report?.quality);
  const contract = asRecord(quality?.contract);
  const food = asRecord(quality?.food);
  const training = asRecord(quality?.training);
  const telemetry = asRecord(report?.telemetry);
  if (
    report?.reportSchemaVersion !== 'ai-live-benchmark.v2' ||
    typeof report.flowLabel !== 'string' ||
    !isNumber(report.completedPlanGenerations) ||
    !isNumber(report.readyPlans) ||
    !isNumber(report.degradedReadyPlans) ||
    !isNumber(report.fallbackPlans) ||
    !isNullableNumber(quality?.averageOverallScore) ||
    !isNumber(contract?.passedPlanCount) ||
    !isNumber(contract?.failedPlanCount) ||
    !isNullableNumber(food?.averageScore) ||
    !isNumber(food?.deterministicFallbackCount) ||
    !isNullableNumber(training?.averageScore) ||
    !isNumber(training?.aiRetryCount) ||
    !isNumber(training?.deterministicFallbackCount) ||
    !isNumber(telemetry?.requestCount) ||
    !isNumber(telemetry?.retryCount) ||
    !isNumber(telemetry?.inputTokens) ||
    !isNumber(telemetry?.outputTokens) ||
    !isNumber(telemetry?.estimatedCostUsd) ||
    !isNumber(telemetry?.costPerCompletedPlanUsd) ||
    !isNumber(telemetry?.averageLatencyMs) ||
    !isNumber(telemetry?.p95LatencyMs)
  ) {
    throw new Error(`${source} is not an ai-live-benchmark.v2 report.`);
  }
}

function identify(report: ComparableBenchmarkReport) {
  return {
    flowLabel: report.flowLabel,
    label: report.label,
    completedPlanGenerations: report.completedPlanGenerations,
    contractPassRatePercent: rate(
      report.quality.contract.passedPlanCount,
      report.completedPlanGenerations
    )
  };
}

function nullableDelta(baseline: number | null, current: number | null) {
  if (baseline === null || current === null) return null;
  return round(current - baseline);
}

function rate(numerator: number, denominator: number) {
  return denominator > 0 ? round((numerator / denominator) * 100) : 0;
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function asRecord(value: unknown) {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isNumber(value);
}
