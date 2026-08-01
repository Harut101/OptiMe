import {
  AiOperationProvider,
  AiOperationStatus,
  PrismaClient
} from '@prisma/client';

import { buildAiReleaseReport } from '../src/modules/ai-operation-logs/ai-release-report';
import { writeAiReleaseReport } from './ai-release-report-output';

const prisma = new PrismaClient();
const strict = process.argv.includes('--strict');
const writeReport = process.argv.includes('--write-report');
const days = readPositiveInteger(process.env.AI_COST_REPORT_DAYS, 30);
const generatedAt = new Date();
const since = new Date(generatedAt.getTime() - days * 24 * 60 * 60 * 1_000);

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
  .then(async ([requestRows, operationRows]) => {
    const report = buildAiReleaseReport({
      requestRows,
      operationRows,
      periodDays: days,
      since,
      generatedAt,
      environment: process.env
    });

    console.log(JSON.stringify(report, null, 2));

    if (writeReport) {
      const outputPath = await writeAiReleaseReport(
        process.env.AI_RELEASE_REPORT_PATH,
        report
      );
      console.error(`AI release report saved: ${outputPath}`);
    }

    if (strict && report.status !== 'PASS') {
      process.exitCode = 2;
    }
  })
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : 'AI cost benchmark failed.'
    );
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

function readPositiveInteger(raw: string | undefined, fallback: number) {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback;
}
