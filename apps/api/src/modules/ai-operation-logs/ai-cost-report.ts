import type {
  AiModelRoute,
  AiRequestAgent,
  AiRequestOperation
} from '@prisma/client';

export interface AiCostReportRow {
  userId: string;
  route: AiModelRoute;
  agent: AiRequestAgent;
  operation: AiRequestOperation;
  estimatedCostMicrousd: number | null;
}

export interface AiCostDistribution {
  sampleCount: number;
  totalCostMicrousd: number;
  medianCostMicrousd: number;
  p95CostMicrousd: number;
}

export function buildAiCostReport(rows: AiCostReportRow[]) {
  const pricedRows = rows.filter(
    (
      row
    ): row is AiCostReportRow & {
      estimatedCostMicrousd: number;
    } => row.estimatedCostMicrousd !== null
  );

  return {
    requestCount: rows.length,
    pricedRequestCount: pricedRows.length,
    unpricedRequestCount: rows.length - pricedRows.length,
    overall: distribution(
      pricedRows.map((row) => row.estimatedCostMicrousd)
    ),
    byRoute: groupDistribution(
      pricedRows,
      (row) => row.route
    ),
    byAgent: groupDistribution(
      pricedRows,
      (row) => row.agent
    ),
    byOperation: groupDistribution(
      pricedRows,
      (row) => row.operation
    ),
    monthlyUserCostByRoute: buildMonthlyUserCostByRoute(
      pricedRows
    )
  };
}

function buildMonthlyUserCostByRoute(
  rows: Array<
    AiCostReportRow & { estimatedCostMicrousd: number }
  >
) {
  const userTotals = new Map<string, number>();

  for (const row of rows) {
    const key = `${row.route}:${row.userId}`;
    userTotals.set(
      key,
      (userTotals.get(key) ?? 0) +
        row.estimatedCostMicrousd
    );
  }

  const byRoute = new Map<string, number[]>();
  for (const [key, total] of userTotals) {
    const route = key.slice(0, key.indexOf(':'));
    byRoute.set(route, [...(byRoute.get(route) ?? []), total]);
  }

  return Object.fromEntries(
    [...byRoute.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([route, costs]) => [route, distribution(costs)])
  );
}

function groupDistribution<T>(
  rows: T[],
  keyFor: (row: T) => string
) {
  const groups = new Map<string, number[]>();

  for (const row of rows) {
    const key = keyFor(row);
    const cost = (
      row as T & { estimatedCostMicrousd: number }
    ).estimatedCostMicrousd;
    groups.set(key, [...(groups.get(key) ?? []), cost]);
  }

  return Object.fromEntries(
    [...groups.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, costs]) => [key, distribution(costs)])
  );
}

function distribution(values: number[]): AiCostDistribution {
  const sorted = [...values].sort(
    (left, right) => left - right
  );

  return {
    sampleCount: sorted.length,
    totalCostMicrousd: sorted.reduce(
      (total, value) => total + value,
      0
    ),
    medianCostMicrousd: percentile(sorted, 0.5),
    p95CostMicrousd: percentile(sorted, 0.95)
  };
}

function percentile(sorted: number[], percentileValue: number) {
  if (sorted.length === 0) return 0;
  const index = Math.max(
    0,
    Math.ceil(sorted.length * percentileValue) - 1
  );
  return sorted[index];
}
