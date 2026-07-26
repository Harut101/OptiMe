import {
  GoalImpactMode,
  PlanQualityMode,
  TrainingLevel,
  UsageFeature
} from '@prisma/client';

import { createMockDailyPlan } from '../daily-plans/templates/mock-daily-plan.factory';
import type { DailyPlanJson } from '../daily-plans/daily-plan-json.schema';
import { DailyPlanTrainingLoadService } from './daily-plan-training-load.service';

describe('DailyPlanTrainingLoadService', () => {
  it('uses deterministic guidance without consuming usage in mock mode', async () => {
    const { service, dependencies } = createService();
    const fallbackSnapshot = createSnapshot(
      'DETERMINISTIC_FALLBACK',
      ['tier_basic_guidance']
    );
    dependencies.trainingLoadAgent.createFallback.mockReturnValue(
      fallbackSnapshot
    );

    const result = await service.apply(createInput({ provider: 'mock' }));

    expect(result.trainingLoadAgentSnapshot).toBe(fallbackSnapshot);
    expect(
      dependencies.featureAccessService.canUseAiTrainingLoadAgent
    ).not.toHaveBeenCalled();
    expect(
      dependencies.usageGuardService.checkAndConsumeConfigured
    ).not.toHaveBeenCalled();
    expect(dependencies.trainingLoadAgent.generate).not.toHaveBeenCalled();
  });

  it('uses a limit fallback when AI training-load usage cannot be consumed', async () => {
    const { service, dependencies } = createService();
    dependencies.featureAccessService.canUseAiTrainingLoadAgent.mockResolvedValue(
      true
    );
    dependencies.usageGuardService.checkAndConsumeConfigured.mockRejectedValue(
      new Error('limit reached')
    );
    const fallbackSnapshot = createSnapshot(
      'DETERMINISTIC_FALLBACK',
      ['ai_training_load_agent_limit_reached']
    );
    dependencies.trainingLoadAgent.createFallback.mockReturnValue(
      fallbackSnapshot
    );

    const result = await service.apply(createInput({ provider: 'openai' }));

    expect(result.trainingLoadAgentSnapshot).toBe(fallbackSnapshot);
    expect(
      dependencies.usageGuardService.checkAndConsumeConfigured
    ).toHaveBeenCalledWith(
      'user-1',
      UsageFeature.AI_TRAINING_LOAD_AGENT
    );
    expect(dependencies.trainingLoadAgent.generate).not.toHaveBeenCalled();
  });

  it('attaches an AI snapshot after entitlement and usage checks pass', async () => {
    const { service, dependencies } = createService();
    dependencies.featureAccessService.canUseAiTrainingLoadAgent.mockResolvedValue(
      true
    );
    dependencies.usageGuardService.checkAndConsumeConfigured.mockResolvedValue({
      id: 'usage-1'
    });
    const aiSnapshot = createSnapshot('AI_TRAINING_LOAD_AGENT', []);
    dependencies.trainingLoadAgent.generate.mockResolvedValue(aiSnapshot);

    const result = await service.apply(createInput({ provider: 'openai' }));

    expect(result.trainingLoadAgentSnapshot).toBe(aiSnapshot);
    expect(dependencies.trainingLoadAgent.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        planLocalDate: '2026-07-26',
        locale: 'ru-RU',
        trainingLevel: TrainingLevel.INTERMEDIATE
      })
    );
    expect(
      dependencies.usageGuardService.refundById
    ).not.toHaveBeenCalled();
  });

  it('refunds usage when the AI request returns a deterministic request-failure fallback', async () => {
    const { service, dependencies } = createService();
    dependencies.featureAccessService.canUseAiTrainingLoadAgent.mockResolvedValue(
      true
    );
    dependencies.usageGuardService.checkAndConsumeConfigured.mockResolvedValue({
      id: 'usage-1'
    });
    dependencies.trainingLoadAgent.generate.mockResolvedValue(
      createSnapshot('DETERMINISTIC_FALLBACK', [
        'training_load_agent_request_failed'
      ])
    );

    await service.apply(createInput({ provider: 'openai' }));

    expect(dependencies.usageGuardService.refundById).toHaveBeenCalledWith(
      'usage-1',
      1
    );
  });
});

function createService() {
  const featureAccessService = {
    canUseAiTrainingLoadAgent: jest.fn().mockResolvedValue(false)
  };
  const trainingLoadAgent = {
    createFallback: jest.fn(),
    generate: jest.fn()
  };
  const usageGuardService = {
    checkAndConsumeConfigured: jest.fn(),
    refundById: jest.fn().mockResolvedValue(undefined)
  };
  const service = new DailyPlanTrainingLoadService(
    featureAccessService as never,
    trainingLoadAgent as never,
    usageGuardService as never
  );

  return {
    service,
    dependencies: {
      featureAccessService,
      trainingLoadAgent,
      usageGuardService
    }
  };
}

function createInput(input: { provider: 'mock' | 'openai' }) {
  const planJson = createMockDailyPlan({
    planLocalDate: '2026-07-26',
    planTimezone: 'UTC',
    isMinor: false
  });

  return {
    planJson,
    user: {
      id: 'user-1',
      safeMode: false,
      isMinor: false,
      trainingPreference: {
        trainingLevel: TrainingLevel.INTERMEDIATE
      }
    },
    locale: 'ru-RU',
    planLocalDate: '2026-07-26',
    planQualityMode: PlanQualityMode.ADAPTIVE,
    personalizationContext: {},
    exerciseSelection: {
      volumePlan: {},
      requestedExerciseCount: 3
    },
    resolvedTrainingDay: {
      isTrainingDay: true
    },
    appMode: GoalImpactMode.NUTRITION_AND_TRAINING,
    provider: input.provider
  } as never;
}

function createSnapshot(
  source: 'AI_TRAINING_LOAD_AGENT' | 'DETERMINISTIC_FALLBACK',
  reasons: string[]
) {
  return {
    source,
    readiness: 'NORMAL',
    adjustments: {
      intensity: 'NORMAL',
      volume: 'NORMAL',
      restTime: 'NORMAL'
    },
    reasonCodes: [],
    userFacingSummary: 'Use the planned session.',
    trainingGuidanceBullets: [],
    exerciseCautions: [],
    validation: {
      status: reasons.length ? 'FALLBACK' : 'VALID',
      reasons
    }
  } as unknown as NonNullable<
    DailyPlanJson['trainingLoadAgentSnapshot']
  >;
}
