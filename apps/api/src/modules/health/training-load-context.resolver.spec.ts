import { HealthProvider } from '@prisma/client';

import type { WearablePlanningContext } from './health-planning.types';
import { TrainingLoadContextResolver } from './training-load-context.resolver';

describe('TrainingLoadContextResolver', () => {
  const resolver = new TrainingLoadContextResolver();

  it('reduces load for fresh low WHOOP recovery', () => {
    const result = resolver.resolve(
      wearableContext({ recoveryScore: 25, reasonCodes: ['LOW_RECOVERY'] })
    );

    expect(result).toMatchObject({
      hasTrainingLoadContext: true,
      readinessHint: 'RECOVERY_FOCUSED',
      reasons: ['LOW_RECOVERY'],
      suggestedAdjustment: {
        intensity: 'REDUCE',
        volume: 'REDUCE',
        restTime: 'INCREASE'
      }
    });
  });

  it('does not increase load for high recovery', () => {
    const result = resolver.resolve(wearableContext({ recoveryScore: 82 }));

    expect(result).toMatchObject({
      readinessHint: 'NORMAL',
      reasons: [],
      suggestedAdjustment: {
        intensity: 'NORMAL',
        volume: 'NORMAL',
        restTime: 'NORMAL'
      }
    });
  });

  it('does not use stale low recovery', () => {
    const result = resolver.resolve(
      wearableContext({
        recoveryScore: 20,
        reasonCodes: ['STALE_WEARABLE_DATA', 'LOW_RECOVERY'],
        isStale: true
      })
    );

    expect(result).toMatchObject({
      hasTrainingLoadContext: false,
      readinessHint: 'UNKNOWN',
      reasons: ['STALE_WEARABLE_DATA']
    });
  });
});

function wearableContext(options: {
  recoveryScore: number;
  reasonCodes?: WearablePlanningContext['reasonCodes'];
  isStale?: boolean;
}): WearablePlanningContext {
  return {
    hasWearableData: true,
    source: HealthProvider.WHOOP,
    localDate: '2026-07-28',
    isStale: options.isStale ?? false,
    activity: {
      steps: null,
      activeCaloriesKcal: null,
      workoutMinutes: null,
      activityLevelHint: 'UNKNOWN'
    },
    sleep: {
      sleepMinutes: null,
      sleepHint: 'UNKNOWN'
    },
    recovery: {
      recoveryScore: options.recoveryScore,
      strainScore: null,
      restingHeartRateBpm: null,
      hrvMs: null,
      respiratoryRate: null,
      recoveryHint: 'RECOVERY_DATA_AVAILABLE'
    },
    reasonCodes: options.reasonCodes ?? ['RECOVERY_DATA_AVAILABLE']
  };
}
