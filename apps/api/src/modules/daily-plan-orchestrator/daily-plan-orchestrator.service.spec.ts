import { PlanStatus } from '@prisma/client';

import { createMockDailyPlan } from '../daily-plans/templates/mock-daily-plan.factory';
import type { DailyPlanJson } from '../daily-plans/daily-plan-json.schema';
import type { RecoveryPlanAgentService } from '../recovery-plan-agent/recovery-plan-agent.service';
import type { TrainingPlanAgentService } from '../training-plan-agent/training-plan-agent.service';
import type { DailyPlanFinalizationService } from './daily-plan-finalization.service';
import type { DailyPlanSafetyOrchestratorService } from './daily-plan-safety-orchestrator.service';
import type { DailyPlanPersistenceService } from './daily-plan-persistence.service';
import type { DailyPlanGenerationContextService } from './daily-plan-generation-context.service';
import type { DailyPlanTrainingLoadService } from './daily-plan-training-load.service';
import { DailyPlanOrchestratorService } from './daily-plan-orchestrator.service';

describe('DailyPlanOrchestratorService', () => {
  it('runs backend decoration, recovery, training, and load stages in order', async () => {
    const events: string[] = [];
    const recoveryPlanAgent = {
      finalizeGeneratedPlan: ({ planJson }: { planJson: DailyPlanJson }) => {
        events.push('recovery');
        return {
          planJson: addReminder(planJson, 'recovery-ready'),
          mode: 'GENTLE',
          contextApplied: true
        };
      }
    } as unknown as RecoveryPlanAgentService;
    const trainingPlanAgent = {
      finalizeGeneratedPlan: async ({ providerPlanResult }: {
        providerPlanResult: { status: PlanStatus; planJson: DailyPlanJson };
      }) => {
        events.push('training');
        expect(providerPlanResult.planJson.reminders).toContain('recovery-ready');
        return {
          ...providerPlanResult,
          usedAiRetry: false,
          usedDeterministicFallback: false
        };
      }
    } as unknown as TrainingPlanAgentService;
    const service = new DailyPlanOrchestratorService(
      trainingPlanAgent,
      recoveryPlanAgent,
      {} as DailyPlanSafetyOrchestratorService,
      {} as DailyPlanPersistenceService,
      {} as DailyPlanGenerationContextService,
      {} as DailyPlanFinalizationService,
      {} as DailyPlanTrainingLoadService
    );
    const plan = createPlan();

    const result = await service.assembleBeforeSafety({
      providerPlanResult: { status: PlanStatus.READY, planJson: plan },
      foodPlan: {} as NonNullable<DailyPlanJson['nutrition']['foodPlan']>,
      exerciseSelection: {} as never,
      trainingEnabled: true,
      isTrainingDay: true,
      decorateProviderPlan: (planJson) => {
        events.push('decorate');
        return addReminder(planJson, 'decorated');
      },
      attachFoodPlan: (planJson) => {
        events.push('attach-food');
        return planJson;
      },
      applyTrainingLoad: async (planJson) => {
        events.push('training-load');
        return addReminder(planJson, 'load-ready');
      }
    });

    expect(events).toEqual([
      'decorate',
      'recovery',
      'attach-food',
      'training',
      'attach-food',
      'training-load'
    ]);
    expect(result.providerPlanResult.planJson.reminders).toEqual(
      expect.arrayContaining(['decorated', 'recovery-ready', 'load-ready'])
    );
  });

  it('passes the bounded training repair callback without invoking it itself', async () => {
    const retryTrainingPlan = jest.fn();
    const trainingPlanAgent = {
      finalizeGeneratedPlan: jest.fn(async (input) => ({
        ...input.providerPlanResult,
        usedAiRetry: false,
        usedDeterministicFallback: false
      }))
    } as unknown as TrainingPlanAgentService;
    const recoveryPlanAgent = {
      finalizeGeneratedPlan: ({ planJson }: { planJson: DailyPlanJson }) => ({
        planJson,
        mode: 'NORMAL',
        contextApplied: false
      })
    } as unknown as RecoveryPlanAgentService;
    const service = new DailyPlanOrchestratorService(
      trainingPlanAgent,
      recoveryPlanAgent,
      {} as DailyPlanSafetyOrchestratorService,
      {} as DailyPlanPersistenceService,
      {} as DailyPlanGenerationContextService,
      {} as DailyPlanFinalizationService,
      {} as DailyPlanTrainingLoadService
    );

    await service.assembleBeforeSafety({
      providerPlanResult: { status: PlanStatus.READY, planJson: createPlan() },
      foodPlan: {} as NonNullable<DailyPlanJson['nutrition']['foodPlan']>,
      exerciseSelection: {} as never,
      trainingEnabled: true,
      isTrainingDay: true,
      decorateProviderPlan: (planJson) => planJson,
      attachFoodPlan: (planJson) => planJson,
      applyTrainingLoad: async (planJson) => planJson,
      retryTrainingPlan
    });

    expect(retryTrainingPlan).not.toHaveBeenCalled();
    expect(trainingPlanAgent.finalizeGeneratedPlan).toHaveBeenCalledWith(
      expect.objectContaining({ retry: retryTrainingPlan })
    );
  });

  it('delegates final safety decisions to the safety orchestrator', async () => {
    const expected = {
      status: PlanStatus.READY,
      planJson: createPlan()
    };
    const safetyOrchestrator = {
      validate: jest.fn().mockResolvedValue(expected)
    } as unknown as DailyPlanSafetyOrchestratorService;
    const service = new DailyPlanOrchestratorService(
      {} as TrainingPlanAgentService,
      {} as RecoveryPlanAgentService,
      safetyOrchestrator,
      {} as DailyPlanPersistenceService,
      {} as DailyPlanGenerationContextService,
      {} as DailyPlanFinalizationService,
      {} as DailyPlanTrainingLoadService
    );
    const input = {
      providerPlan: expected.planJson,
      blockedFoods: { allergies: [], excludedFoods: [] },
      planLocalDate: '2026-07-26',
      planTimezone: 'UTC',
      locale: 'en-US' as const,
      userContext: {
        safeMode: false,
        isMinor: false,
        limitationsOrPainAreas: [],
        painOrDiscomfortReported: false,
        highTirednessReported: false,
        goal: null
      }
    };

    await expect(service.validateBeforePersistence(input)).resolves.toBe(
      expected
    );
    expect(safetyOrchestrator.validate).toHaveBeenCalledWith(input);
  });

  it('completes one bounded generation attempt when safety does not request a retry', async () => {
    const service = createWorkflowService();
    const plan = createPlan();
    const foodPlan = {} as NonNullable<
      DailyPlanJson['nutrition']['foodPlan']
    >;
    const providerPlanResult = { status: PlanStatus.READY, planJson: plan };
    const trainingPreparation = {
      ...providerPlanResult,
      usedAiRetry: false,
      usedDeterministicFallback: false
    };
    jest.spyOn(service, 'assembleBeforeSafety').mockResolvedValue({
      providerPlanResult,
      trainingPreparation
    });
    const generateProviderPlan = jest.fn().mockResolvedValue(providerPlanResult);
    const generateFoodPlan = jest.fn().mockResolvedValue(foodPlan);
    const validateAttempt = jest.fn().mockResolvedValue(providerPlanResult);

    const result = await service.executeGenerationWorkflow({
      generateProviderPlan,
      generateFoodPlan,
      buildAssemblyInput: jest.fn(() => ({} as never)),
      validateAttempt,
      canUseSafetyRetry: () => true,
      getProviderFallbackReason: () => undefined,
      createRetryFailureFallback: jest.fn()
    });

    expect(result).toEqual({
      safePlanResult: providerPlanResult,
      finalFoodPlan: foodPlan,
      trainingPreparation
    });
    expect(generateProviderPlan).toHaveBeenCalledTimes(1);
    expect(generateFoodPlan).toHaveBeenCalledTimes(1);
    expect(validateAttempt).toHaveBeenCalledWith({
      providerPlanResult,
      allowSafetyRetry: true,
      safetyRetryUsed: false
    });
  });

  it('runs exactly one complete retry with safety feedback and aggregates training repair metadata', async () => {
    const service = createWorkflowService();
    const initialPlan = createPlan();
    const retryPlan = addReminder(createPlan(), 'retry');
    const safetyFeedback = {
      riskLevel: 'medium' as const,
      reasons: ['unsafe implication'],
      requiredChanges: ['use supportive guidance']
    };
    const initialProvider = {
      status: PlanStatus.READY,
      planJson: initialPlan
    };
    const retryProvider = {
      status: PlanStatus.READY,
      planJson: retryPlan
    };
    const initialTraining = {
      ...initialProvider,
      usedAiRetry: true,
      usedDeterministicFallback: false
    };
    const retryTraining = {
      ...retryProvider,
      usedAiRetry: false,
      usedDeterministicFallback: true
    };
    jest
      .spyOn(service, 'assembleBeforeSafety')
      .mockResolvedValueOnce({
        providerPlanResult: initialProvider,
        trainingPreparation: initialTraining
      })
      .mockResolvedValueOnce({
        providerPlanResult: retryProvider,
        trainingPreparation: retryTraining
      });
    const generateProviderPlan = jest
      .fn()
      .mockResolvedValueOnce(initialProvider)
      .mockResolvedValueOnce(retryProvider);
    const generateFoodPlan = jest
      .fn()
      .mockResolvedValueOnce({ id: 'initial-food' })
      .mockResolvedValueOnce({ id: 'retry-food' });
    const validateAttempt = jest
      .fn()
      .mockResolvedValueOnce({
        ...initialProvider,
        safetyRetryRequest: safetyFeedback
      })
      .mockResolvedValueOnce(retryProvider);

    const result = await service.executeGenerationWorkflow({
      generateProviderPlan,
      generateFoodPlan,
      buildAssemblyInput: jest.fn(() => ({} as never)),
      validateAttempt,
      canUseSafetyRetry: () => true,
      getProviderFallbackReason: () => undefined,
      createRetryFailureFallback: jest.fn()
    });

    expect(generateProviderPlan).toHaveBeenCalledTimes(2);
    expect(generateProviderPlan).toHaveBeenNthCalledWith(2, {
      safetyFeedback
    });
    expect(generateFoodPlan).toHaveBeenCalledTimes(2);
    expect(validateAttempt).toHaveBeenNthCalledWith(2, {
      providerPlanResult: retryProvider,
      allowSafetyRetry: false,
      safetyRetryUsed: true
    });
    expect(result.trainingPreparation).toEqual(
      expect.objectContaining({
        usedAiRetry: true,
        usedDeterministicFallback: true
      })
    );
    expect(result.finalFoodPlan).toEqual({ id: 'retry-food' });
  });

  it('uses the bounded retry fallback when the second provider plan remains invalid', async () => {
    const service = createWorkflowService();
    const plan = createPlan();
    const providerPlanResult = {
      status: PlanStatus.FALLBACK,
      planJson: plan
    };
    const trainingPreparation = {
      ...providerPlanResult,
      usedAiRetry: false,
      usedDeterministicFallback: true
    };
    jest
      .spyOn(service, 'assembleBeforeSafety')
      .mockResolvedValueOnce({
        providerPlanResult: {
          status: PlanStatus.READY,
          planJson: plan
        },
        trainingPreparation: {
          ...trainingPreparation,
          status: PlanStatus.READY,
          usedDeterministicFallback: false
        }
      })
      .mockResolvedValueOnce({
        providerPlanResult,
        trainingPreparation
      });
    const fallbackResult = {
      status: PlanStatus.FALLBACK,
      planJson: addReminder(plan, 'bounded-fallback')
    };
    const createRetryFailureFallback = jest
      .fn()
      .mockReturnValue(fallbackResult);

    const result = await service.executeGenerationWorkflow({
      generateProviderPlan: jest
        .fn()
        .mockResolvedValueOnce({ status: PlanStatus.READY, planJson: plan })
        .mockResolvedValueOnce(providerPlanResult),
      generateFoodPlan: jest.fn().mockResolvedValue({}),
      buildAssemblyInput: jest.fn(() => ({} as never)),
      validateAttempt: jest
        .fn()
        .mockResolvedValueOnce({
          status: PlanStatus.FALLBACK,
          planJson: plan,
          safetyRetryRequest: {
            riskLevel: 'high',
            reasons: ['unsafe'],
            requiredChanges: ['replace unsafe advice']
          }
        })
        .mockResolvedValueOnce(providerPlanResult),
      canUseSafetyRetry: () => true,
      getProviderFallbackReason: () => 'schema_validation_failed',
      createRetryFailureFallback
    });

    expect(createRetryFailureFallback).toHaveBeenCalledWith(
      'safety_agent_retry_invalid_output'
    );
    expect(result.safePlanResult).toBe(fallbackResult);
  });
});

function createPlan() {
  return createMockDailyPlan({
    planLocalDate: '2026-07-26',
    planTimezone: 'UTC',
    isMinor: false
  });
}

function addReminder(planJson: DailyPlanJson, reminder: string): DailyPlanJson {
  return {
    ...planJson,
    reminders: [...planJson.reminders, reminder]
  };
}

function createWorkflowService() {
  return new DailyPlanOrchestratorService(
    {} as TrainingPlanAgentService,
    {} as RecoveryPlanAgentService,
    {} as DailyPlanSafetyOrchestratorService,
    {} as DailyPlanPersistenceService,
    {} as DailyPlanGenerationContextService,
    {} as DailyPlanFinalizationService,
    {} as DailyPlanTrainingLoadService
  );
}
