import {
  GoalImpactMode,
  PlanQualityMode,
  PlanStatus,
  UsageFeature,
  UsagePeriodType
} from '@prisma/client';

import { createMockDailyPlan } from '../daily-plans/templates/mock-daily-plan.factory';
import type { OnboardingService } from '../onboarding/onboarding.service';
import type { UsageGuardService } from '../usage/usage-guard.service';
import type { GenerateDailyPlanUseCaseInput } from './daily-plan-generation-use-case.interface';
import { DailyPlanGenerationUseCaseService } from './daily-plan-generation-use-case.service';
import type { DailyPlanOrchestratorService } from './daily-plan-orchestrator.service';

describe('DailyPlanGenerationUseCaseService', () => {
  it('returns an existing current plan without consuming usage', async () => {
    const dependencies = createDependencies();
    const service = createService(dependencies);
    const input = createInput({
      existingPlan: createDatabasePlan()
    });

    const result = await service.generate(input);

    expect(result).toBe(input.existingPlan);
    expect(
      dependencies.usageGuardService.assertCanUse
    ).not.toHaveBeenCalled();
    expect(
      dependencies.orchestrator.prepareGenerationContext
    ).not.toHaveBeenCalled();
  });

  it('owns usage, generation, finalization, and persistence for an OpenAI plan', async () => {
    const dependencies = createDependencies();
    const service = createService(dependencies);
    const planJson = createPlanJson();
    const persistedPlan = createDatabasePlan();
    const foodPlan = { meals: [] };
    const safePlanResult = {
      status: PlanStatus.READY,
      planJson
    };
    const trainingPreparation = {
      ...safePlanResult,
      usedAiRetry: false,
      usedDeterministicFallback: false
    };
    dependencies.orchestrator.getProviderName.mockReturnValue(
      'openai'
    );
    dependencies.orchestrator.prepareGenerationContext.mockResolvedValue(
      createGenerationContext()
    );
    dependencies.orchestrator.executeGenerationWorkflow.mockResolvedValue({
      safePlanResult,
      finalFoodPlan: foodPlan,
      trainingPreparation
    });
    dependencies.orchestrator.finalizeGenerationResult.mockResolvedValue({
      safePlanResult,
      status: PlanStatus.READY,
      finalExerciseIds: []
    });
    dependencies.orchestrator.persistGeneratedPlan.mockResolvedValue({
      plan: persistedPlan,
      status: PlanStatus.READY
    });

    const result = await service.generate(createInput());

    expect(result).toBe(persistedPlan);
    expect(
      dependencies.usageGuardService.assertCanUse
    ).toHaveBeenCalledTimes(2);
    expect(
      dependencies.usageGuardService.checkAndConsume
    ).toHaveBeenNthCalledWith(
      1,
      'user-1',
      UsageFeature.DAILY_PLAN_GENERATION,
      UsagePeriodType.DAILY
    );
    expect(
      dependencies.usageGuardService.checkAndConsume
    ).toHaveBeenNthCalledWith(
      2,
      'user-1',
      UsageFeature.AI_DAILY_PLAN_GENERATION,
      UsagePeriodType.DAILY
    );
    expect(
      dependencies.orchestrator.finalizeGenerationResult
    ).toHaveBeenCalled();
    expect(
      dependencies.orchestrator.persistGeneratedPlan
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        planLocalDate: '2026-07-26',
        planTimezone: 'UTC',
        result: safePlanResult
      })
    );
  });

  it('refunds all consumed usage and records generation errors', async () => {
    const dependencies = createDependencies();
    const service = createService(dependencies);
    const generationError = new Error('provider failed');
    dependencies.orchestrator.getProviderName.mockReturnValue(
      'openai'
    );
    dependencies.orchestrator.prepareGenerationContext.mockRejectedValue(
      generationError
    );

    await expect(service.generate(createInput())).rejects.toBe(
      generationError
    );

    expect(
      dependencies.usageGuardService.refundById
    ).toHaveBeenNthCalledWith(1, 'usage-ai', 1);
    expect(
      dependencies.usageGuardService.refundById
    ).toHaveBeenNthCalledWith(2, 'usage-plan', 1);
    expect(
      dependencies.orchestrator.recordGenerationError
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        error: generationError
      })
    );
  });
});

function createService(dependencies: ReturnType<typeof createDependencies>) {
  return new DailyPlanGenerationUseCaseService(
    dependencies.orchestrator as unknown as DailyPlanOrchestratorService,
    dependencies.usageGuardService as unknown as UsageGuardService,
    dependencies.onboardingService as unknown as OnboardingService
  );
}

function createDependencies() {
  return {
    orchestrator: {
      getProviderName: jest.fn().mockReturnValue('mock'),
      prepareGenerationContext: jest.fn(),
      executeGenerationWorkflow: jest.fn(),
      finalizeGenerationResult: jest.fn(),
      persistGeneratedPlan: jest.fn(),
      recordGeneration: jest.fn(),
      recordGenerationError: jest.fn(),
      getOperationContext: jest.fn().mockReturnValue({
        provider: 'mock',
        safetyAgentEnabled: false,
        safetyAgentProvider: 'mock'
      })
    },
    usageGuardService: {
      assertCanUse: jest.fn(),
      checkAndConsume: jest
        .fn()
        .mockResolvedValueOnce({ id: 'usage-plan' })
        .mockResolvedValueOnce({ id: 'usage-ai' }),
      refundById: jest.fn()
    },
    onboardingService: {
      evaluateStage1Readiness: jest.fn().mockReturnValue({
        canGenerateFirstPlan: true,
        missingStage1Fields: []
      })
    }
  };
}

function createInput(
  overrides: Partial<GenerateDailyPlanUseCaseInput> = {}
): GenerateDailyPlanUseCaseInput {
  return {
    userId: 'user-1',
    user: {
      id: 'user-1',
      timezone: 'UTC'
    } as never,
    existingPlan: null,
    planLocalDate: '2026-07-26',
    planTimezone: 'UTC',
    locale: 'en-US',
    forceRegenerate: false,
    recreateForCurrentLanguage: false,
    ...overrides
  };
}

function createGenerationContext() {
  return {
    planQualityMode: PlanQualityMode.BASIC,
    availableFoodSlugs: [],
    appMode: GoalImpactMode.NUTRITION_AND_TRAINING,
    trainingEnabled: true,
    resolvedTrainingDay: {
      isTrainingDay: true
    },
    nutritionTarget: {},
    personalizationContext: {
      selectedProtocols: undefined,
      healthPlanningContext: undefined
    },
    exerciseSelection: {},
    blockedFoods: {
      allergies: [],
      excludedFoods: []
    }
  };
}

function createPlanJson() {
  return createMockDailyPlan({
    planLocalDate: '2026-07-26',
    planTimezone: 'UTC',
    isMinor: false
  });
}

function createDatabasePlan() {
  return {
    id: 'plan-1',
    userId: 'user-1',
    planLocalDate: '2026-07-26',
    planTimezone: 'UTC',
    status: PlanStatus.READY,
    readinessLevel: 'MAINTAIN',
    planJson: createPlanJson(),
    createdAt: new Date('2026-07-26T00:00:00.000Z'),
    updatedAt: new Date('2026-07-26T00:00:00.000Z')
  } as never;
}
