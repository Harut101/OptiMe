import { EvaluatePlanCheckpointRequest, PlanCheckpointFacts } from '@optime/shared-types';

import { PlanCheckpointMaterialChangeDetectorService } from './plan-checkpoint-material-change-detector.service';

const capturedAt = '2026-07-26T08:00:00.000Z';

function createFacts(overrides: Partial<PlanCheckpointFacts> = {}): PlanCheckpointFacts {
  return {
    capturedAt,
    health: {
      source: null,
      localDate: null,
      sleepMinutes: null,
      steps: null,
      activeCaloriesKcal: null,
      workoutMinutes: null,
      ...overrides.health
    },
    progress: {
      completedMeals: 0,
      skippedMeals: 0,
      workoutStatus: 'NOT_STARTED',
      ...overrides.progress
    },
    checkIn: {
      energyLevel: null,
      tirednessLevel: null,
      sorenessLevel: null,
      ...overrides.checkIn
    },
    safetySignals: {
      painOrLimitation: false,
      illness: false,
      dizziness: false,
      exhaustion: false,
      ...overrides.safetySignals
    }
  };
}

function createInput(
  baseline: PlanCheckpointFacts,
  current: PlanCheckpointFacts
): EvaluatePlanCheckpointRequest {
  return {
    trigger: 'APP_OPEN',
    planLocalDate: '2026-07-26',
    baseline,
    current
  };
}

describe('PlanCheckpointMaterialChangeDetectorService', () => {
  const service = new PlanCheckpointMaterialChangeDetectorService();

  it('does not recommend a review when facts did not materially change', () => {
    const facts = createFacts({
      health: {
        source: 'APPLE_HEALTH',
        localDate: '2026-07-26',
        sleepMinutes: 450,
        steps: 2200,
        activeCaloriesKcal: 180,
        workoutMinutes: 0
      }
    });

    expect(service.evaluate(createInput(facts, facts))).toEqual({
      trigger: 'APP_OPEN',
      materialChangeDetected: false,
      reviewRecommended: false,
      requiresSafetyReview: false,
      severity: 'NONE',
      affectedSections: [],
      reasonCodes: []
    });
  });

  it('detects newly available low sleep without treating missing baseline as unsafe', () => {
    const result = service.evaluate(
      createInput(
        createFacts(),
        createFacts({
          health: {
            source: 'APPLE_HEALTH',
            localDate: '2026-07-26',
            sleepMinutes: 320,
            steps: null,
            activeCaloriesKcal: null,
            workoutMinutes: null
          }
        })
      )
    );

    expect(result.reasonCodes).toEqual(['LOW_SLEEP_DETECTED']);
    expect(result.severity).toBe('HIGH');
    expect(result.requiresSafetyReview).toBe(false);
  });

  it('detects a material step increase and high-activity threshold crossing', () => {
    const result = service.evaluate(
      createInput(
        createFacts({
          health: {
            source: 'APPLE_HEALTH',
            localDate: '2026-07-26',
            sleepMinutes: 440,
            steps: 5000,
            activeCaloriesKcal: 250,
            workoutMinutes: 0
          }
        }),
        createFacts({
          health: {
            source: 'APPLE_HEALTH',
            localDate: '2026-07-26',
            sleepMinutes: 440,
            steps: 12500,
            activeCaloriesKcal: 700,
            workoutMinutes: 0
          }
        })
      )
    );

    expect(result.reasonCodes).toEqual([
      'HIGH_ACTIVITY_DETECTED',
      'ACTIVITY_INCREASED'
    ]);
    expect(result.affectedSections).toEqual([
      'NUTRITION_TARGET',
      'TRAINING_PLAN',
      'RECOVERY',
      'WEARABLE_CONTEXT'
    ]);
  });

  it('detects completed workout progress without requiring wearable data', () => {
    const result = service.evaluate(
      createInput(
        createFacts(),
        createFacts({
          progress: {
            completedMeals: 0,
            skippedMeals: 0,
            workoutStatus: 'COMPLETED'
          }
        })
      )
    );

    expect(result.reasonCodes).toEqual(['WORKOUT_COMPLETED']);
    expect(result.reviewRecommended).toBe(true);
    expect(result.severity).toBe('MEDIUM');
  });

  it('detects a newly skipped meal but not ordinary meal completion', () => {
    const skipped = service.evaluate(
      createInput(
        createFacts(),
        createFacts({
          progress: {
            completedMeals: 1,
            skippedMeals: 1,
            workoutStatus: 'NOT_STARTED'
          }
        })
      )
    );
    const completed = service.evaluate(
      createInput(
        createFacts(),
        createFacts({
          progress: {
            completedMeals: 1,
            skippedMeals: 0,
            workoutStatus: 'NOT_STARTED'
          }
        })
      )
    );

    expect(skipped.reasonCodes).toEqual(['MEAL_SKIPPED']);
    expect(completed.materialChangeDetected).toBe(false);
  });

  it('prioritizes newly reported pain as a deterministic safety review', () => {
    const result = service.evaluate(
      createInput(
        createFacts(),
        createFacts({
          safetySignals: {
            painOrLimitation: true,
            illness: false,
            dizziness: false,
            exhaustion: false
          }
        })
      )
    );

    expect(result.reasonCodes).toEqual(['NEW_PAIN_OR_LIMITATION']);
    expect(result.severity).toBe('SAFETY_CRITICAL');
    expect(result.requiresSafetyReview).toBe(true);
    expect(result.affectedSections).toEqual(['TRAINING_PLAN', 'RECOVERY', 'SAFETY']);
  });

  it('detects high tiredness and soreness check-ins', () => {
    const result = service.evaluate(
      createInput(
        createFacts({
          checkIn: {
            energyLevel: 7,
            tirednessLevel: 4,
            sorenessLevel: 3
          }
        }),
        createFacts({
          checkIn: {
            energyLevel: 7,
            tirednessLevel: 8,
            sorenessLevel: 8
          }
        })
      )
    );

    expect(result.reasonCodes).toEqual([
      'HIGH_TIREDNESS_REPORTED',
      'HIGH_SORENESS_REPORTED'
    ]);
    expect(result.severity).toBe('HIGH');
  });

  it('ignores unavailable current health metrics instead of inferring a decline', () => {
    const result = service.evaluate(
      createInput(
        createFacts({
          health: {
            source: 'APPLE_HEALTH',
            localDate: '2026-07-26',
            sleepMinutes: 480,
            steps: 10000,
            activeCaloriesKcal: 650,
            workoutMinutes: 45
          }
        }),
        createFacts()
      )
    );

    expect(result.materialChangeDetected).toBe(false);
    expect(result.reasonCodes).toEqual([]);
  });
});
