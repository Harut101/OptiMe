import { SubscriptionPlan } from '@prisma/client';

import { buildAiCostReport, type AiCostReportRow } from './ai-cost-report';
import {
  evaluateAiUnitEconomics,
  readAiUnitEconomicsConfig
} from './ai-unit-economics';
import {
  evaluateAiQualityGate,
  readAiQualityGateConfig,
  type AiQualityGateStatus
} from './ai-quality-gate';
import {
  buildAiQualityReport,
  type AiQualityReportRow
} from './ai-quality-report';

export interface AiReleaseReportInput {
  requestRows: AiCostReportRow[];
  operationRows: AiQualityReportRow[];
  periodDays: number;
  since: Date;
  generatedAt: Date;
  environment: NodeJS.ProcessEnv;
}

export function buildAiReleaseReport(input: AiReleaseReportInput) {
  const costReport = buildAiCostReport(input.requestRows);
  const unitEconomics = evaluateAiUnitEconomics(
    costReport,
    readAiUnitEconomicsConfig(input.environment)
  );
  const qualityReport = buildAiQualityReport(input.operationRows);
  const qualityGate = evaluateAiQualityGate(
    qualityReport,
    readAiQualityGateConfig(input.environment)
  );
  const status = aggregateStatus([unitEconomics.status, qualityGate.status]);

  return {
    reportSchemaVersion: 'ai-release-monitor.v1' as const,
    generatedAt: input.generatedAt.toISOString(),
    periodDays: input.periodDays,
    since: input.since.toISOString(),
    currency: 'USD' as const,
    sources: ['AiRequestLog', 'AiOperationLog'] as const,
    status,
    summary: {
      requestCount: costReport.requestCount,
      operationCount: qualityReport.operationCount,
      unitEconomicsStatus: unitEconomics.status,
      qualityGateStatus: qualityGate.status,
      tiers: Object.values(SubscriptionPlan).map((plan) => {
        const economicsTier = unitEconomics.tiers.find(
          (tier) => tier.plan === plan
        );
        const qualityTier = qualityGate.tiers.find(
          (tier) => tier.plan === plan
        );

        return {
          plan,
          economicsStatus: economicsTier?.status ?? 'INSUFFICIENT_DATA',
          qualityStatus: qualityTier?.status ?? 'INSUFFICIENT_DATA',
          economicsReasons: economicsTier?.reasons ?? [
            'tier_economics_missing'
          ],
          qualityReasons: qualityTier?.reasons ?? ['tier_quality_missing']
        };
      })
    },
    costReport,
    unitEconomics,
    qualityReport,
    qualityGate
  };
}

function aggregateStatus(statuses: AiQualityGateStatus[]) {
  if (statuses.includes('FAIL')) return 'FAIL' as const;
  if (statuses.includes('INSUFFICIENT_DATA')) {
    return 'INSUFFICIENT_DATA' as const;
  }
  return 'PASS' as const;
}
