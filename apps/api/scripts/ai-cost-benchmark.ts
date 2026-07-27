import {
  AiOperationStatus,
  PrismaClient
} from '@prisma/client';

import { buildAiCostReport } from '../src/modules/ai-operation-logs/ai-cost-report';
import {
  evaluateAiUnitEconomics,
  readAiUnitEconomicsConfig
} from '../src/modules/ai-operation-logs/ai-unit-economics';

const prisma = new PrismaClient();
const strict = process.argv.includes('--strict');
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
    const costReport = buildAiCostReport(rows);
    const economics = evaluateAiUnitEconomics(
      costReport,
      readAiUnitEconomicsConfig(process.env)
    );

    console.log(
      JSON.stringify(
        {
          periodDays: days,
          since: since.toISOString(),
          currency: 'USD',
          source: 'AiRequestLog',
          status: economics.status,
          costReport,
          unitEconomics: economics
        },
        null,
        2
      )
    );

    if (strict && economics.status !== 'PASS') {
      process.exitCode = 2;
    }
  })
  .catch((error: unknown) => {
    console.error(
      error instanceof Error
        ? error.message
        : 'AI cost benchmark failed.'
    );
    process.exitCode = 1;
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
