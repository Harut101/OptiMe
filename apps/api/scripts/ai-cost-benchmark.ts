import {
  AiOperationProvider,
  AiOperationStatus,
  PrismaClient
} from '@prisma/client';

import { buildAiCostReport } from '../src/modules/ai-operation-logs/ai-cost-report';
import {
  evaluateAiUnitEconomics,
  readAiUnitEconomicsConfig
} from '../src/modules/ai-operation-logs/ai-unit-economics';
import {
  evaluateAiQualityGate,
  readAiQualityGateConfig,
  type AiQualityGateStatus
} from '../src/modules/ai-operation-logs/ai-quality-gate';
import { buildAiQualityReport } from '../src/modules/ai-operation-logs/ai-quality-report';

const prisma = new PrismaClient();
const strict = process.argv.includes('--strict');
const days = readPositiveInteger(
  process.env.AI_COST_REPORT_DAYS,
  30
);
const since = new Date(
  Date.now() - days * 24 * 60 * 60 * 1_000
);

void Promise.all([
  prisma.aiRequestLog.findMany({
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
  }),
  prisma.aiOperationLog.findMany({
    where: {
      provider: AiOperationProvider.OPENAI,
      createdAt: { gte: since }
    },
    select: {
      userId: true,
      route: true,
      planQualityMode: true,
      status: true,
      finalPlanStatus: true,
      retryCount: true
    }
  })
])
  .then(([requestRows, operationRows]) => {
    const costReport = buildAiCostReport(requestRows);
    const economics = evaluateAiUnitEconomics(
      costReport,
      readAiUnitEconomicsConfig(process.env)
    );
    const qualityReport = buildAiQualityReport(operationRows);
    const qualityGate = evaluateAiQualityGate(
      qualityReport,
      readAiQualityGateConfig(process.env)
    );
    const status = aggregateStatus([
      economics.status,
      qualityGate.status
    ]);

    console.log(
      JSON.stringify(
        {
          periodDays: days,
          since: since.toISOString(),
          currency: 'USD',
          sources: ['AiRequestLog', 'AiOperationLog'],
          status,
          costReport,
          unitEconomics: economics,
          qualityReport,
          qualityGate
        },
        null,
        2
      )
    );

    if (strict && status !== 'PASS') {
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

function aggregateStatus(statuses: AiQualityGateStatus[]) {
  if (statuses.includes('FAIL')) return 'FAIL' as const;
  if (statuses.includes('INSUFFICIENT_DATA')) {
    return 'INSUFFICIENT_DATA' as const;
  }
  return 'PASS' as const;
}
