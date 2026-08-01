import { SubscriptionPlan } from '@prisma/client';

import { AI_MODEL_CONFIG_BY_ROUTE } from '../modules/ai-model-routing/ai-model-router.service';
import { readAiQualityGateConfig } from '../modules/ai-operation-logs/ai-quality-gate';
import { readAiUnitEconomicsConfig } from '../modules/ai-operation-logs/ai-unit-economics';
import { validateEnvironment } from './environment.validation';

export function buildAiReleasePreflight(input: NodeJS.ProcessEnv) {
  const environment: NodeJS.ProcessEnv = {
    ...input,
    NODE_ENV: 'production',
  };

  validateEnvironment(environment);

  const economics = readAiUnitEconomicsConfig(environment);
  const quality = readAiQualityGateConfig(environment);
  const routes = Object.entries(AI_MODEL_CONFIG_BY_ROUTE).map(
    ([route, config]) => ({
      tier: config.tier,
      route,
      model: requireString(environment, config.model),
      inputCostPerMillionUsd: requireNumber(environment, config.inputCost),
      outputCostPerMillionUsd: requireNumber(environment, config.outputCost),
      monthlyCostCeilingUsd:
        economics.monthlyCostCeilingUsd[config.tier as SubscriptionPlan],
    }),
  );

  return {
    status: 'PASS' as const,
    validatedEnvironment: 'production' as const,
    aiProvider: 'openai' as const,
    openAiApiKeyConfigured: true,
    routes,
    safetyAgent: {
      enabled: true,
      provider: 'openai' as const,
    },
    costControl: {
      enabled: true,
      reportDays: readPositiveInteger(environment.AI_COST_REPORT_DAYS, 30),
      sampleMinimum: economics.sampleMinimum,
      pricedCoverageMinimumPercent: economics.pricedCoverageMinimumPercent,
      storefrontCommissionPercent: economics.storefrontCommissionPercent,
      medianCostMaximumPercentNet: economics.medianCostMaximumPercentNet,
      p95CostMaximumPercentNet: economics.p95CostMaximumPercentNet,
    },
    qualityGate: quality,
    nextRequiredGate: 'ai-release:gate' as const,
  };
}

function requireString(environment: NodeJS.ProcessEnv, key: string) {
  const value = environment[key]?.trim();
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

function requireNumber(environment: NodeJS.ProcessEnv, key: string) {
  const value = Number(requireString(environment, key));
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${key} must be a positive number.`);
  }
  return value;
}

function readPositiveInteger(raw: string | undefined, fallback: number) {
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('AI_COST_REPORT_DAYS must be a positive number.');
  }
  return Math.trunc(value);
}
