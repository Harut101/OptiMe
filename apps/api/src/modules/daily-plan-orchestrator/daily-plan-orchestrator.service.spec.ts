import { PlanStatus } from '@prisma/client';

import { createMockDailyPlan } from '../daily-plans/templates/mock-daily-plan.factory';
import type { DailyPlanJson } from '../daily-plans/daily-plan-json.schema';
import type { RecoveryPlanAgentService } from '../recovery-plan-agent/recovery-plan-agent.service';
import type { TrainingPlanAgentService } from '../training-plan-agent/training-plan-agent.service';
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
      recoveryPlanAgent
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
      recoveryPlanAgent
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
