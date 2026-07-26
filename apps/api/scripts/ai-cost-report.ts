import {
  AiOperationStatus,
  PrismaClient
} from '@prisma/client';

import { buildAiCostReport } from '../src/modules/ai-operation-logs/ai-cost-report';

const prisma = new PrismaClient();
const days = readPositiveInteger(
  process.env.AI_COST_REPORT_DAYS,
  30
);
const since = new Date(
  Date.now() - days * 24 * 60 * 60 * 1_000
);

void prisma.aiRequestLog
  .findMany({
    where: {
      status: AiOperationStatus.SUCCESS,
      createdAt: { gte: since }
    },
    select: {
      userId: true,
      route: true,
      agent: true,
      operation: true,
      estimatedCostMicrousd: true
    }
  })
  .then((rows) => {
    const report = buildAiCostReport(rows);
    console.log(
      JSON.stringify(
        {
          periodDays: days,
          since: since.toISOString(),
          currency: 'USD',
          unit: 'micro-USD',
          ...report
        },
        null,
        2
      )
    );
  })
  .finally(async () => prisma.$disconnect());

function readPositiveInteger(
  raw: string | undefined,
  fallback: number
) {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : fallback;
}
