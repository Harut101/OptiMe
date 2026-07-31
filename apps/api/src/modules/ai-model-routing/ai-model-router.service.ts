import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiModelRoute, AiRequestAgent, PlanQualityMode } from '@prisma/client';

export interface AiModelSelection {
  agent: AiRequestAgent;
  route: AiModelRoute;
  model: string;
  inputCostPerMillionUsd: number | null;
  outputCostPerMillionUsd: number | null;
}

export const AI_MODEL_CONFIG_BY_ROUTE: Record<
  AiModelRoute,
  {
    tier: 'FREE' | 'PLUS' | 'PRO';
    model: string;
    inputCost: string;
    outputCost: string;
    legacyModel: string;
    legacyInputCost: string;
    legacyOutputCost: string;
  }
> = {
  [AiModelRoute.LUNA]: {
    tier: 'FREE',
    model: 'OPENAI_DAILY_PLAN_MODEL_FREE',
    inputCost: 'OPENAI_DAILY_PLAN_FREE_INPUT_COST_PER_1M_USD',
    outputCost: 'OPENAI_DAILY_PLAN_FREE_OUTPUT_COST_PER_1M_USD',
    legacyModel: 'OPENAI_MODEL_LUNA',
    legacyInputCost: 'OPENAI_LUNA_INPUT_COST_PER_1M_USD',
    legacyOutputCost: 'OPENAI_LUNA_OUTPUT_COST_PER_1M_USD'
  },
  [AiModelRoute.TERRA]: {
    tier: 'PLUS',
    model: 'OPENAI_DAILY_PLAN_MODEL_PLUS',
    inputCost: 'OPENAI_DAILY_PLAN_PLUS_INPUT_COST_PER_1M_USD',
    outputCost: 'OPENAI_DAILY_PLAN_PLUS_OUTPUT_COST_PER_1M_USD',
    legacyModel: 'OPENAI_MODEL_TERRA',
    legacyInputCost: 'OPENAI_TERRA_INPUT_COST_PER_1M_USD',
    legacyOutputCost: 'OPENAI_TERRA_OUTPUT_COST_PER_1M_USD'
  },
  [AiModelRoute.SOL]: {
    tier: 'PRO',
    model: 'OPENAI_DAILY_PLAN_MODEL_PRO',
    inputCost: 'OPENAI_DAILY_PLAN_PRO_INPUT_COST_PER_1M_USD',
    outputCost: 'OPENAI_DAILY_PLAN_PRO_OUTPUT_COST_PER_1M_USD',
    legacyModel: 'OPENAI_MODEL_SOL',
    legacyInputCost: 'OPENAI_SOL_INPUT_COST_PER_1M_USD',
    legacyOutputCost: 'OPENAI_SOL_OUTPUT_COST_PER_1M_USD'
  }
};

export function hasOpenAiModelConfiguration(
  configService: Pick<ConfigService, 'get'>
) {
  if (configService.get<string>('OPENAI_DEFAULT_MODEL')?.trim()) {
    return true;
  }

  return Object.values(AI_MODEL_CONFIG_BY_ROUTE).every(
    (config) =>
      configService.get<string>(config.model)?.trim() ||
      configService.get<string>(config.legacyModel)?.trim()
  );
}

@Injectable()
export class AiModelRouterService {
  constructor(private readonly configService: ConfigService) {}

  resolve(input: {
    agent: AiRequestAgent;
    planQualityMode: PlanQualityMode;
  }): AiModelSelection {
    const route = this.resolveRoute(input.planQualityMode);
    const config = AI_MODEL_CONFIG_BY_ROUTE[route];
    const model =
      this.readString(config.model) ??
      this.readString(config.legacyModel) ??
      this.readString('OPENAI_DEFAULT_MODEL');

    if (!model) {
      throw new Error(
        `${config.model} or OPENAI_DEFAULT_MODEL is required for ${config.tier} daily planning.`
      );
    }

    return {
      agent: input.agent,
      route,
      model,
      inputCostPerMillionUsd: this.readTierCost(
        config,
        config.inputCost,
        config.legacyInputCost
      ),
      outputCostPerMillionUsd: this.readTierCost(
        config,
        config.outputCost,
        config.legacyOutputCost
      )
    };
  }

  resolveRoute(planQualityMode: PlanQualityMode) {
    return this.routeForMode(planQualityMode);
  }

  estimateCostMicrousd(
    selection: AiModelSelection,
    usage: { inputTokens: number; outputTokens: number }
  ) {
    if (
      selection.inputCostPerMillionUsd === null &&
      selection.outputCostPerMillionUsd === null
    ) {
      return null;
    }

    // tokens * USD-per-1M equals micro-USD for the request.
    return Math.max(
      0,
      Math.round(
        usage.inputTokens * (selection.inputCostPerMillionUsd ?? 0) +
          usage.outputTokens * (selection.outputCostPerMillionUsd ?? 0)
      )
    );
  }

  private routeForMode(planQualityMode: PlanQualityMode) {
    switch (planQualityMode) {
      case PlanQualityMode.ADAPTIVE:
        return AiModelRoute.SOL;
      case PlanQualityMode.PERSONALIZED:
        return AiModelRoute.TERRA;
      case PlanQualityMode.BASIC:
      default:
        return AiModelRoute.LUNA;
    }
  }

  private readString(key: string) {
    const value = this.configService.get<string>(key)?.trim();
    return value ? value : null;
  }

  private readNonNegativeNumber(key: string) {
    const raw = this.configService.get<string>(key);
    if (raw === undefined || raw.trim() === '') return null;

    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  private readTierCost(
    config: (typeof AI_MODEL_CONFIG_BY_ROUTE)[AiModelRoute],
    key: string,
    legacyKey: string
  ) {
    const preferred = this.readNonNegativeNumber(key);
    if (preferred !== null) return preferred;

    const usesLegacyModel =
      !this.readString(config.model) && Boolean(this.readString(config.legacyModel));
    return usesLegacyModel
      ? this.readNonNegativeNumber(legacyKey)
      : null;
  }
}
