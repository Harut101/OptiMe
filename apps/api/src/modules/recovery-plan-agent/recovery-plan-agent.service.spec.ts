import { createMockDailyPlan } from '../daily-plans/templates/mock-daily-plan.factory';
import {
  EMPTY_HEALTH_PLANNING_CONTEXT,
  type HealthPlanningContext
} from '../health/health-planning.types';
import { recoveryProtocols } from '../protocol/recovery-protocols';
import { RecoveryPlanAgentService } from './recovery-plan-agent.service';

describe('RecoveryPlanAgentService', () => {
  const service = new RecoveryPlanAgentService();

  it('adds a gentle recovery context for recent low sleep', () => {
    const plan = createPlan();
    const result = service.finalizeGeneratedPlan({
      planJson: plan,
      recoveryProtocol: recoveryProtocols.HIGH_TIREDNESS,
      healthPlanningContext: healthContext({
        lowSleep: true,
        sleepHint: 'LOW_SLEEP'
      }),
      trainingEnabled: true,
      isTrainingDay: true
    });

    expect(result.mode).toBe('GENTLE');
    expect(result.planJson.contextNotes?.recovery).toMatchObject({
      titleCode: 'RECOVERY_CONTEXT',
      messageCode: 'GENTLER_RECOVERY_FOCUS'
    });
  });

  it('does not infer a negative recovery state from stale wearable data', () => {
    const result = service.finalizeGeneratedPlan({
      planJson: createPlan(),
      recoveryProtocol: recoveryProtocols.NORMAL_RECOVERY,
      healthPlanningContext: healthContext({
        lowSleep: true,
        sleepHint: 'LOW_SLEEP',
        isStale: true
      }),
      trainingEnabled: true,
      isTrainingDay: true
    });

    expect(result.mode).toBe('NORMAL');
    expect(result.planJson.contextNotes?.wearable?.messageCode).toBe('WEARABLE_DATA_STALE');
    expect(result.planJson.contextNotes?.recovery).toBeUndefined();
  });

  it('applies conservative recovery context for pain without wearable data', () => {
    const result = service.finalizeGeneratedPlan({
      planJson: createPlan(),
      recoveryProtocol: recoveryProtocols.PAIN_OR_DISCOMFORT,
      trainingEnabled: true,
      isTrainingDay: true
    });

    expect(result.mode).toBe('CONSERVATIVE');
    expect(result.planJson.contextNotes?.recovery).toEqual({
      titleCode: 'RECOVERY_CONTEXT',
      messageCode: 'GENTLER_RECOVERY_FOCUS',
      reasonCodes: []
    });
  });

  it('does not rewrite provider nutrition, training, or recovery content', () => {
    const plan = createPlan();
    const result = service.finalizeGeneratedPlan({
      planJson: plan,
      recoveryProtocol: recoveryProtocols.PREGNANCY_POSTPARTUM_CONSERVATIVE,
      trainingEnabled: true,
      isTrainingDay: true
    });

    expect(result.planJson.nutrition).toEqual(plan.nutrition);
    expect(result.planJson.training).toEqual(plan.training);
    expect(result.planJson.recovery).toEqual(plan.recovery);
  });
});

function createPlan() {
  return createMockDailyPlan({
    planLocalDate: '2026-07-26',
    planTimezone: 'UTC',
    isMinor: false
  });
}

function healthContext(options: {
  lowSleep: boolean;
  sleepHint: 'LOW_SLEEP' | 'OK_SLEEP';
  isStale?: boolean;
}): HealthPlanningContext {
  return {
    ...EMPTY_HEALTH_PLANNING_CONTEXT,
    available: true,
    wearablePlanningContext: {
      ...EMPTY_HEALTH_PLANNING_CONTEXT.wearablePlanningContext,
      hasWearableData: true,
      source: 'APPLE_HEALTH',
      localDate: '2026-07-26',
      isStale: options.isStale ?? false,
      sleep: {
        sleepMinutes: 300,
        sleepHint: options.sleepHint
      },
      reasonCodes: options.isStale ? ['STALE_WEARABLE_DATA'] : ['LOW_SLEEP']
    },
    signals: {
      ...EMPTY_HEALTH_PLANNING_CONTEXT.signals,
      lowSleep: options.lowSleep
    }
  };
}
