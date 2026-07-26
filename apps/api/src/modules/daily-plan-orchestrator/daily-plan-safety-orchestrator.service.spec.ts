import { PlanStatus } from '@prisma/client';

import type { DailyPlanJson } from '../daily-plans/daily-plan-json.schema';
import { createMockDailyPlan } from '../daily-plans/templates/mock-daily-plan.factory';
import type { SafetyAgent } from '../safety-agent/safety-agent.interface';
import type { SafetyAgentConfig } from '../safety-agent/safety-agent.token';
import { SafetyService } from '../safety/safety.service';
import type { ValidateDailyPlanSafetyInput } from './daily-plan-safety-orchestrator.interface';
import { DailyPlanSafetyOrchestratorService } from './daily-plan-safety-orchestrator.service';

describe('DailyPlanSafetyOrchestratorService', () => {
  it('runs deterministic safety before the Safety Agent', async () => {
    const safetyAgent = {
      reviewDailyPlan: jest.fn()
    } as unknown as SafetyAgent;
    const service = createService(safetyAgent, {
      enabled: true,
      provider: 'mock'
    });
    const plan = createPlan();
    plan.nutrition.meals[0].foods[0].name = 'Avocado toast';

    const result = await service.validate(
      createInput(plan, { allergies: ['avocado'], excludedFoods: [] })
    );

    expect(result.status).toBe(PlanStatus.FALLBACK);
    expect(safetyAgent.reviewDailyPlan).not.toHaveBeenCalled();
  });

  it('does not call the Safety Agent when semantic review is disabled', async () => {
    const safetyAgent = {
      reviewDailyPlan: jest.fn()
    } as unknown as SafetyAgent;
    const service = createService(safetyAgent, {
      enabled: false,
      provider: 'mock'
    });

    const result = await service.validate(createInput(createPlan()));

    expect(result.status).toBe(PlanStatus.READY);
    expect(safetyAgent.reviewDailyPlan).not.toHaveBeenCalled();
  });

  it('returns actionable safety feedback for one bounded retry', async () => {
    const safetyAgent = {
      reviewDailyPlan: jest.fn().mockResolvedValue({
        approved: false,
        riskLevel: 'medium',
        reasons: ['The plan includes unsafe training advice.'],
        requiredChanges: ['Replace unsafe training advice with a light option.']
      })
    } as unknown as SafetyAgent;
    const service = createService(safetyAgent, {
      enabled: true,
      provider: 'openai'
    });

    const result = await service.validate(
      createInput(createPlan(), undefined, { allowSafetyRetry: true })
    );

    expect(result.status).toBe(PlanStatus.FALLBACK);
    expect(result.safetyRetryRequest).toEqual({
      riskLevel: 'medium',
      reasons: ['The plan includes unsafe training advice.'],
      requiredChanges: ['Replace unsafe training advice with a light option.']
    });
    expect(result.planJson.debug?.safetyAgent?.retryUsed).toBe(false);
  });

  it('fails closed when a Safety Agent review is invalid', async () => {
    const safetyAgent = {
      reviewDailyPlan: jest.fn().mockResolvedValue({
        approved: false,
        riskLevel: 'medium',
        reasons: [],
        requiredChanges: []
      })
    } as unknown as SafetyAgent;
    const service = createService(safetyAgent, {
      enabled: true,
      provider: 'mock'
    });

    const result = await service.validate(createInput(createPlan()));

    expect(result.status).toBe(PlanStatus.FALLBACK);
    expect(result.planJson.debug?.fallbackReason).toBe(
      'safety_agent_invalid_review'
    );
  });

  it('maps planning and check-in data into deterministic safety context', async () => {
    const service = createService(
      { reviewDailyPlan: jest.fn() } as unknown as SafetyAgent,
      { enabled: false, provider: 'mock' }
    );
    const expected = {
      status: PlanStatus.READY,
      planJson: createPlan()
    };
    const validate = jest
      .spyOn(service, 'validate')
      .mockReturnValue(expected);

    const result = await service.validateGeneratedPlan({
      providerPlan: expected.planJson,
      blockedFoods: {
        allergies: ['avocado'],
        excludedFoods: ['pork']
      },
      planLocalDate: '2026-07-26',
      planTimezone: 'UTC',
      locale: 'en-US',
      user: {
        safeMode: true,
        isMinor: true,
        profile: {
          gender: 'FEMALE',
          pregnancyStatus: 'PREGNANT'
        },
        trainingPreference: {
          trainingLevel: 'BEGINNER',
          limitationsOrPainAreas: ['knee']
        },
        goal: {
          goalType: 'WEIGHT_LOSS',
          targetWeightKg: 60,
          targetTimelineDays: 90,
          impactMode: 'NUTRITION_AND_TRAINING'
        }
      } as never,
      personalizationContext: {
        checkInSummary: {
          painOrDiscomfortReported: true,
          highTirednessReported: true
        }
      } as never
    });

    expect(result).toBe(expected);
    expect(validate).toHaveBeenCalledWith(
      expect.objectContaining({
        userContext: {
          safeMode: true,
          isMinor: true,
          gender: 'FEMALE',
          pregnancyStatus: 'PREGNANT',
          trainingLevel: 'BEGINNER',
          limitationsOrPainAreas: ['knee'],
          painOrDiscomfortReported: true,
          highTirednessReported: true,
          goal: {
            goalType: 'WEIGHT_LOSS',
            targetWeightKg: 60,
            targetTimelineDays: 90,
            impactMode: 'NUTRITION_AND_TRAINING'
          }
        }
      })
    );
  });

  it('allows safety retry only for a ready OpenAI plan when enabled', () => {
    const enabled = createService(
      { reviewDailyPlan: jest.fn() } as unknown as SafetyAgent,
      { enabled: true, provider: 'openai' }
    );
    const disabled = createService(
      { reviewDailyPlan: jest.fn() } as unknown as SafetyAgent,
      { enabled: false, provider: 'openai' }
    );

    expect(
      enabled.canUseSafetyRetry(PlanStatus.READY, 'openai')
    ).toBe(true);
    expect(
      enabled.canUseSafetyRetry(PlanStatus.FALLBACK, 'openai')
    ).toBe(false);
    expect(
      enabled.canUseSafetyRetry(PlanStatus.READY, 'mock')
    ).toBe(false);
    expect(
      disabled.canUseSafetyRetry(PlanStatus.READY, 'openai')
    ).toBe(false);
  });

  it('owns safe operation metadata and provider fallback extraction', () => {
    const service = createService(
      { reviewDailyPlan: jest.fn() } as unknown as SafetyAgent,
      { enabled: true, provider: 'openai' }
    );

    expect(service.getOperationContext()).toEqual({
      safetyAgentEnabled: true,
      safetyAgentProvider: 'openai'
    });
    expect(
      service.getFallbackReason({
        debug: { fallbackReason: 'schema_validation_failed' }
      })
    ).toBe('schema_validation_failed');
    expect(service.getFallbackReason({ debug: {} })).toBeUndefined();
  });
});

function createService(
  safetyAgent: SafetyAgent,
  config: SafetyAgentConfig
) {
  return new DailyPlanSafetyOrchestratorService(
    new SafetyService(),
    safetyAgent,
    config
  );
}

function createPlan() {
  return createMockDailyPlan({
    planLocalDate: '2026-07-26',
    planTimezone: 'UTC',
    isMinor: false
  });
}

function createInput(
  providerPlan: DailyPlanJson,
  blockedFoods = { allergies: [] as string[], excludedFoods: [] as string[] },
  overrides: Partial<ValidateDailyPlanSafetyInput> = {}
): ValidateDailyPlanSafetyInput {
  return {
    providerPlan,
    blockedFoods,
    planLocalDate: '2026-07-26',
    planTimezone: 'UTC',
    locale: 'en-US',
    userContext: {
      safeMode: false,
      isMinor: false,
      gender: null,
      pregnancyStatus: 'UNKNOWN',
      trainingLevel: null,
      limitationsOrPainAreas: [],
      painOrDiscomfortReported: false,
      highTirednessReported: false,
      goal: null
    },
    ...overrides
  };
}
