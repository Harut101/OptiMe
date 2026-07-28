import { HealthProvider } from '@prisma/client';

import {
  WEARABLE_LOW_RECOVERY_SCORE,
  WearablePlanningContextResolver
} from './wearable-planning-context.resolver';

describe('WearablePlanningContextResolver', () => {
  const resolver = new WearablePlanningContextResolver();

  it('classifies the documented WHOOP low-recovery band conservatively', () => {
    const low = resolver.resolve(snapshot(WEARABLE_LOW_RECOVERY_SCORE), {
      isStale: false
    });
    const moderate = resolver.resolve(
      snapshot(WEARABLE_LOW_RECOVERY_SCORE + 1),
      { isStale: false }
    );

    expect(low.reasonCodes).toContain('LOW_RECOVERY');
    expect(moderate.reasonCodes).not.toContain('LOW_RECOVERY');
  });

  it('keeps missing recovery neutral', () => {
    const result = resolver.resolve(snapshot(null), { isStale: false });

    expect(result.recovery.recoveryHint).toBe('UNKNOWN');
    expect(result.reasonCodes).not.toContain('LOW_RECOVERY');
  });
});

function snapshot(recoveryScore: number | null) {
  return {
    source: HealthProvider.WHOOP,
    localDate: '2026-07-28',
    steps: null,
    activeCaloriesKcal: null,
    workoutMinutes: null,
    sleepMinutes: null,
    recoveryScore,
    strainScore: null,
    restingHeartRateBpm: null,
    hrvMs: null,
    respiratoryRate: null
  };
}
