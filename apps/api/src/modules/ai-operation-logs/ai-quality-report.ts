import type {
  AiModelRoute,
  AiOperationStatus,
  PlanQualityMode,
  PlanStatus
} from '@prisma/client';

export interface AiQualityReportRow {
  userId: string;
  route: AiModelRoute | null;
  planQualityMode: PlanQualityMode | null;
  status: AiOperationStatus;
  finalPlanStatus: PlanStatus | null;
  retryCount: number;
}

export interface AiQualityDistribution {
  operationCount: number;
  observedOperationCount: number;
  sampleCount: number;
  telemetryCoveragePercent: number;
  readyCount: number;
  readyRatePercent: number;
  fallbackCount: number;
  fallbackRatePercent: number;
  errorCount: number;
  errorRatePercent: number;
  retryOperationCount: number;
  retryRatePercent: number;
}

export function buildAiQualityReport(rows: AiQualityReportRow[]) {
  const attributedRows = rows.filter(
    (row): row is AiQualityReportRow & { route: AiModelRoute } =>
      row.route !== null
  );

  return {
    operationCount: rows.length,
    attributedOperationCount: attributedRows.length,
    unattributedOperationCount: rows.length - attributedRows.length,
    routeCoveragePercent: percentage(attributedRows.length, rows.length),
    overall: distribution(rows),
    byRoute: groupDistribution(attributedRows)
  };
}

function groupDistribution(
  rows: Array<AiQualityReportRow & { route: AiModelRoute }>
) {
  const groups = new Map<AiModelRoute, AiQualityReportRow[]>();

  for (const row of rows) {
    groups.set(row.route, [...(groups.get(row.route) ?? []), row]);
  }

  return Object.fromEntries(
    [...groups.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([route, routeRows]) => [route, distribution(routeRows)])
  ) as Partial<Record<AiModelRoute, AiQualityDistribution>>;
}

function distribution(
  rows: AiQualityReportRow[]
): AiQualityDistribution {
  const observedRows = rows.filter(
    (row) =>
      row.finalPlanStatus !== null || row.status === 'ERROR'
  );
  const readyCount = observedRows.filter(
    (row) => row.finalPlanStatus === 'READY'
  ).length;
  const fallbackCount = observedRows.filter(
    (row) =>
      row.status === 'FALLBACK' ||
      row.finalPlanStatus === 'FALLBACK'
  ).length;
  const errorCount = observedRows.filter(
    (row) => row.status === 'ERROR'
  ).length;
  const retryOperationCount = observedRows.filter(
    (row) => row.retryCount > 0
  ).length;

  return {
    operationCount: rows.length,
    observedOperationCount: observedRows.length,
    sampleCount: new Set(observedRows.map((row) => row.userId)).size,
    telemetryCoveragePercent: percentage(
      observedRows.length,
      rows.length
    ),
    readyCount,
    readyRatePercent: percentage(
      readyCount,
      observedRows.length
    ),
    fallbackCount,
    fallbackRatePercent: percentage(
      fallbackCount,
      observedRows.length
    ),
    errorCount,
    errorRatePercent: percentage(
      errorCount,
      observedRows.length
    ),
    retryOperationCount,
    retryRatePercent: percentage(
      retryOperationCount,
      observedRows.length
    )
  };
}

function percentage(value: number, total: number) {
  if (total === 0) return 0;
  return round((value / total) * 100, 2);
}

function round(value: number, decimals: number) {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}
