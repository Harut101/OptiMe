import { Injectable } from '@nestjs/common';

import {
  EMPTY_TRAINING_LOAD_CONTEXT,
  TrainingLoadContext,
  TrainingLoadReasonCode,
  WearablePlanningContext
} from './health-planning.types';

@Injectable()
export class TrainingLoadContextResolver {
  resolve(wearableContext: WearablePlanningContext): TrainingLoadContext {
    if (!wearableContext.hasWearableData) {
      return EMPTY_TRAINING_LOAD_CONTEXT;
    }

    if (wearableContext.isStale) {
      return {
        hasTrainingLoadContext: false,
        readinessHint: 'UNKNOWN',
        reasons: ['STALE_WEARABLE_DATA'],
        suggestedAdjustment: {
          intensity: 'UNKNOWN',
          volume: 'UNKNOWN',
          restTime: 'UNKNOWN'
        },
        userFacingHint: null
      };
    }

    const reasons = this.resolveReasons(wearableContext);
    if (reasons.length === 0) {
      return {
        hasTrainingLoadContext: true,
        readinessHint: 'NORMAL',
        reasons: [],
        suggestedAdjustment: {
          intensity: 'NORMAL',
          volume: 'NORMAL',
          restTime: 'NORMAL'
        },
        userFacingHint: null
      };
    }

    const recoveryFocused =
      reasons.includes('LOW_SLEEP') &&
      (reasons.includes('HIGH_ACTIVITY') || reasons.includes('RECENT_WORKOUT_LOAD'));

    return {
      hasTrainingLoadContext: true,
      readinessHint: recoveryFocused ? 'RECOVERY_FOCUSED' : 'CONTROLLED',
      reasons,
      suggestedAdjustment: {
        intensity: 'REDUCE',
        volume: recoveryFocused ? 'REDUCE' : 'NORMAL',
        restTime: 'INCREASE'
      },
      userFacingHint: recoveryFocused
        ? 'Recent sleep and activity signals suggest keeping effort gentle and taking longer rests today.'
        : 'Recent wearable signals suggest keeping today controlled and adjusting effort down if needed.'
    };
  }

  private resolveReasons(wearableContext: WearablePlanningContext): TrainingLoadReasonCode[] {
    const reasons = new Set<TrainingLoadReasonCode>();

    if (wearableContext.reasonCodes.includes('PARTIAL_WEARABLE_DATA')) {
      reasons.add('PARTIAL_WEARABLE_DATA');
    }
    if (wearableContext.sleep.sleepHint === 'LOW_SLEEP') {
      reasons.add('LOW_SLEEP');
    }
    if (wearableContext.activity.activityLevelHint === 'HIGH') {
      reasons.add('HIGH_ACTIVITY');
    }
    if ((wearableContext.activity.workoutMinutes ?? 0) > 0) {
      reasons.add('RECENT_WORKOUT_LOAD');
    }

    return Array.from(reasons);
  }
}
