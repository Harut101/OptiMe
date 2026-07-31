import { AiModelRoute, AiRequestAgent, PlanQualityMode } from '@prisma/client';
import type { ConfigService } from '@nestjs/config';

import {
  AiModelRouterService,
  hasOpenAiModelConfiguration
} from './ai-model-router.service';

describe('AiModelRouterService', () => {
  it.each([
    [PlanQualityMode.BASIC, AiModelRoute.LUNA, 'luna-model'],
    [PlanQualityMode.PERSONALIZED, AiModelRoute.TERRA, 'terra-model'],
    [PlanQualityMode.ADAPTIVE, AiModelRoute.SOL, 'sol-model']
  ])('routes %s through %s', (mode, route, model) => {
    const service = createService({
      OPENAI_DAILY_PLAN_MODEL_FREE: 'luna-model',
      OPENAI_DAILY_PLAN_MODEL_PLUS: 'terra-model',
      OPENAI_DAILY_PLAN_MODEL_PRO: 'sol-model'
    });

    expect(
      service.resolve({
        agent: AiRequestAgent.DAILY_PLAN,
        planQualityMode: mode
      })
    ).toMatchObject({ route, model });
  });

  it('uses OPENAI_DEFAULT_MODEL as a backward-compatible fallback', () => {
    const service = createService({
      OPENAI_DEFAULT_MODEL: 'default-model'
    });

    expect(
      service.resolve({
        agent: AiRequestAgent.SAFETY,
        planQualityMode: PlanQualityMode.ADAPTIVE
      })
    ).toMatchObject({
      agent: AiRequestAgent.SAFETY,
      route: AiModelRoute.SOL,
      model: 'default-model'
    });
  });

  it('estimates micro-USD only when route prices are configured', () => {
    const service = createService({
      OPENAI_DAILY_PLAN_MODEL_FREE: 'luna-model',
      OPENAI_DAILY_PLAN_FREE_INPUT_COST_PER_1M_USD: '0.25',
      OPENAI_DAILY_PLAN_FREE_OUTPUT_COST_PER_1M_USD: '2'
    });
    const selection = service.resolve({
      agent: AiRequestAgent.NUTRITION,
      planQualityMode: PlanQualityMode.BASIC
    });

    expect(
      service.estimateCostMicrousd(selection, {
        inputTokens: 1_000,
        outputTokens: 500
      })
    ).toBe(1_250);
  });

  it('prefers tier config while accepting legacy route config during migration', () => {
    const preferred = createService({
      OPENAI_DAILY_PLAN_MODEL_PRO: 'preferred-terra-model',
      OPENAI_MODEL_SOL: 'legacy-sol-model'
    });
    const legacy = createService({
      OPENAI_MODEL_SOL: 'legacy-sol-model'
    });

    expect(
      preferred.resolve({
        agent: AiRequestAgent.DAILY_PLAN,
        planQualityMode: PlanQualityMode.ADAPTIVE
      }).model
    ).toBe('preferred-terra-model');
    expect(
      legacy.resolve({
        agent: AiRequestAgent.DAILY_PLAN,
        planQualityMode: PlanQualityMode.ADAPTIVE
      }).model
    ).toBe('legacy-sol-model');
  });

  it('does not apply a legacy route price to a newly configured tier model', () => {
    const preferred = createService({
      OPENAI_DAILY_PLAN_MODEL_PRO: 'preferred-terra-model',
      OPENAI_SOL_INPUT_COST_PER_1M_USD: '99',
      OPENAI_SOL_OUTPUT_COST_PER_1M_USD: '99'
    }).resolve({
      agent: AiRequestAgent.DAILY_PLAN,
      planQualityMode: PlanQualityMode.ADAPTIVE
    });
    const legacy = createService({
      OPENAI_MODEL_SOL: 'legacy-sol-model',
      OPENAI_SOL_INPUT_COST_PER_1M_USD: '2',
      OPENAI_SOL_OUTPUT_COST_PER_1M_USD: '12'
    }).resolve({
      agent: AiRequestAgent.DAILY_PLAN,
      planQualityMode: PlanQualityMode.ADAPTIVE
    });

    expect(preferred.inputCostPerMillionUsd).toBeNull();
    expect(preferred.outputCostPerMillionUsd).toBeNull();
    expect(legacy.inputCostPerMillionUsd).toBe(2);
    expect(legacy.outputCostPerMillionUsd).toBe(12);
  });

  it('accepts a default model or a complete tier model configuration', () => {
    expect(
      hasOpenAiModelConfiguration(
        createConfigService({
          OPENAI_DEFAULT_MODEL: 'default-model'
        })
      )
    ).toBe(true);
    expect(
      hasOpenAiModelConfiguration(
        createConfigService({
          OPENAI_DAILY_PLAN_MODEL_FREE: 'free-model',
          OPENAI_DAILY_PLAN_MODEL_PLUS: 'plus-model',
          OPENAI_DAILY_PLAN_MODEL_PRO: 'pro-model'
        })
      )
    ).toBe(true);
    expect(
      hasOpenAiModelConfiguration(
        createConfigService({
          OPENAI_DAILY_PLAN_MODEL_FREE: 'free-model',
          OPENAI_DAILY_PLAN_MODEL_PLUS: 'plus-model'
        })
      )
    ).toBe(false);
  });
});

function createService(values: Record<string, string>) {
  return new AiModelRouterService(createConfigService(values));
}

function createConfigService(values: Record<string, string>) {
  return {
    get: jest.fn((key: string) => values[key])
  } as unknown as ConfigService;
}
