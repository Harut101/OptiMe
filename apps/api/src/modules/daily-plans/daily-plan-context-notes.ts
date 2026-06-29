import type { DailyPlanJson } from './daily-plan-json.schema';
import type { HealthPlanningContext } from '../health/health-planning.types';

type ContextMessageCode =
  | 'RECENT_ACTIVITY_AND_SLEEP_AVAILABLE'
  | 'RECENT_ACTIVITY_INCLUDED'
  | 'RECENT_SLEEP_INCLUDED'
  | 'NO_RECENT_WEARABLE_DATA_USED'
  | 'WEARABLE_DATA_STALE'
  | 'KEEP_WORKOUT_CONTROLLED'
  | 'TAKE_LONGER_RESTS'
  | 'GENTLER_RECOVERY_FOCUS';

export function withRecoveryAwareContextNotes(
  planJson: DailyPlanJson,
  options: {
    healthPlanningContext?: HealthPlanningContext;
    trainingEnabled: boolean;
    isTrainingDay: boolean;
  }
): DailyPlanJson {
  const contextNotes = buildDailyPlanContextNotes(options);

  if (!contextNotes) {
    return planJson;
  }

  return {
    ...planJson,
    contextNotes
  };
}

export function buildDailyPlanContextNotes(options: {
  healthPlanningContext?: HealthPlanningContext;
  trainingEnabled: boolean;
  isTrainingDay: boolean;
}): DailyPlanJson['contextNotes'] | undefined {
  const wearable = options.healthPlanningContext?.wearablePlanningContext;
  const trainingLoad = options.healthPlanningContext?.trainingLoadContext;

  if (!wearable) {
    return undefined;
  }

  const notes: DailyPlanJson['contextNotes'] = {};

  notes.wearable = {
    titleCode: wearable.source === 'APPLE_HEALTH'
      ? 'APPLE_HEALTH_DATA_INCLUDED'
      : wearable.hasWearableData
        ? 'WEARABLE_DATA_INCLUDED'
        : 'USING_PROFILE_AND_SCHEDULE',
    messageCode: getWearableMessageCode(wearable),
    reasonCodes: wearable.reasonCodes
  };

  if (
    wearable.hasWearableData &&
    !wearable.isStale &&
    (wearable.sleep.sleepHint === 'LOW_SLEEP' ||
      wearable.activity.activityLevelHint === 'HIGH' ||
      wearable.reasonCodes.includes('RECENT_WORKOUT_LOAD'))
  ) {
    notes.recovery = {
      titleCode: 'RECOVERY_CONTEXT',
      messageCode: wearable.sleep.sleepHint === 'LOW_SLEEP'
        ? 'GENTLER_RECOVERY_FOCUS'
        : 'RECENT_ACTIVITY_INCLUDED',
      reasonCodes: wearable.reasonCodes
    };
  }

  if (
    options.trainingEnabled &&
    options.isTrainingDay &&
    trainingLoad?.hasTrainingLoadContext &&
    trainingLoad.readinessHint !== 'NORMAL' &&
    trainingLoad.readinessHint !== 'UNKNOWN'
  ) {
    notes.trainingLoad = {
      titleCode: 'TRAINING_LOAD_CONTEXT',
      messageCode: trainingLoad.suggestedAdjustment.restTime === 'INCREASE'
        ? 'TAKE_LONGER_RESTS'
        : 'KEEP_WORKOUT_CONTROLLED',
      readinessHint: trainingLoad.readinessHint,
      reasonCodes: trainingLoad.reasons
    };
  }

  return Object.keys(notes).length > 0 ? notes : undefined;
}

function getWearableMessageCode(
  wearable: NonNullable<HealthPlanningContext['wearablePlanningContext']>
): ContextMessageCode {
  if (!wearable.hasWearableData) {
    return 'NO_RECENT_WEARABLE_DATA_USED';
  }

  if (wearable.isStale) {
    return 'WEARABLE_DATA_STALE';
  }

  if (
    wearable.activity.activityLevelHint !== 'UNKNOWN' &&
    wearable.sleep.sleepHint !== 'UNKNOWN'
  ) {
    return 'RECENT_ACTIVITY_AND_SLEEP_AVAILABLE';
  }

  if (wearable.activity.activityLevelHint !== 'UNKNOWN') {
    return 'RECENT_ACTIVITY_INCLUDED';
  }

  if (wearable.sleep.sleepHint !== 'UNKNOWN') {
    return 'RECENT_SLEEP_INCLUDED';
  }

  return 'NO_RECENT_WEARABLE_DATA_USED';
}
