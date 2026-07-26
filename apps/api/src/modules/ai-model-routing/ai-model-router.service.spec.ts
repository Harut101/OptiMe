import {
  AiModelRoute,
  AiRequestAgent,
  PlanQualityMode
} from '@prisma/client';
import type { ConfigService } from '@nestjs/config';

import { AiModelRouterService } from './ai-model-router.service';

describe('AiModelRouterService', () => {
  it.each([
    [PlanQualityMode.BASIC, AiModelRoute.LUNA, 'luna-model'],
    [PlanQualityMode.PERSONALIZED, AiModelRoute.TERRA, 'terra-model'],
    [PlanQualityMode.ADAPTIVE, AiModelRoute.SOL, 'sol-model']
  ])('routes %s through %s', (mode, route, model) => {
    const service = createService({
      OPENAI_MODEL_LUNA: 'luna-model',
      OPENAI_MODEL_TERRA: 'terra-model',
      OPENAI_MODEL_SOL: 'sol-model'
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
      OPENAI_MODEL_LUNA: 'luna-model',
      OPENAI_LUNA_INPUT_COST_PER_1M_USD: '0.25',
      OPENAI_LUNA_OUTPUT_COST_PER_1M_USD: '2'
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
});

function createService(values: Record<string, string>) {
  const configService = {
    get: jest.fn((key: string) => values[key])
  };

  return new AiModelRouterService(
    configService as unknown as ConfigService
  );
}
