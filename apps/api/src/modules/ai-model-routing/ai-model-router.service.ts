import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiModelRoute,
  AiRequestAgent,
  PlanQualityMode
} from '@prisma/client';

export interface AiModelSelection {
  agent: AiRequestAgent;
  route: AiModelRoute;
  model: string;
  inputCostPerMillionUsd: number | null;
  outputCostPerMillionUsd: number | null;
}

@Injectable()
export class AiModelRouterService {
  constructor(private readonly configService: ConfigService) {}

  resolve(input: {
    agent: AiRequestAgent;
    planQualityMode: PlanQualityMode;
  }): AiModelSelection {
    const route = this.resolveRoute(input.planQualityMode);
    const model =
      this.readString(`OPENAI_MODEL_${route}`) ??
      this.readString('OPENAI_DEFAULT_MODEL');

    if (!model) {
      throw new Error(
        `OPENAI_MODEL_${route} or OPENAI_DEFAULT_MODEL is required for route ${route}.`
      );
    }

    return {
      agent: input.agent,
      route,
      model,
      inputCostPerMillionUsd: this.readNonNegativeNumber(
        `OPENAI_${route}_INPUT_COST_PER_1M_USD`
      ),
      outputCostPerMillionUsd: this.readNonNegativeNumber(
        `OPENAI_${route}_OUTPUT_COST_PER_1M_USD`
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
        usage.inputTokens *
          (selection.inputCostPerMillionUsd ?? 0) +
          usage.outputTokens *
            (selection.outputCostPerMillionUsd ?? 0)
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
}
