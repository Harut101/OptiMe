import {
  GoalImpactMode,
  PlanQualityMode,
  PlanStatus
} from '@prisma/client';

import { createMockDailyPlan } from '../daily-plans/templates/mock-daily-plan.factory';
import type { DailyPlanJson } from '../daily-plans/daily-plan-json.schema';
import { DailyPlanFinalizationService } from './daily-plan-finalization.service';

describe('DailyPlanFinalizationService', () => {
  it('prepares provider metadata and disables training in nutrition-only mode', () => {
    const { service, dependencies } = createService();
    const resolvedTrainingDay = createResolvedTrainingDay(false);

    const result = service.prepareProviderPlanDocument({
      planJson: createPlan(),
      resolvedTrainingDay,
      nutritionTarget: { id: 'target' } as never,
      appMode: GoalImpactMode.NUTRITION_ONLY,
      locale: 'en-US'
    });

    expect(result.training.intensity).toBe('REST');
    expect(result.training.exercises).toEqual([]);
    expect(result.trainingScheduleSnapshot).toBe(resolvedTrainingDay);
    expect(result.nutritionTargetSnapshot).toEqual({
      source: 'nutrition-target'
    });
    expect(dependencies.nutritionTargetsService.toSnapshot).toHaveBeenCalled();
  });

  it('finalizes food, recovery, debug metadata, and checkpoint baseline once', async () => {
    const { service, dependencies } = createService();
    const foodPlan = createFoodPlan();
    const resolvedTrainingDay = createResolvedTrainingDay(true);
    const selection = createExerciseSelection();

    const result = await service.finalize({
      userId: 'user-1',
      planLocalDate: '2026-07-26',
      existingPlanId: 'plan-1',
      safePlanResult: {
        status: PlanStatus.READY,
        planJson: createPlan()
      },
      finalFoodPlan: foodPlan,
      trainingPreparation: {
        status: PlanStatus.READY,
        planJson: createPlan(),
        usedAiRetry: true,
        usedDeterministicFallback: false
      },
      exerciseSelection: selection,
      resolvedTrainingDay,
      nutritionTarget: { id: 'target' } as never,
      planQualityMode: PlanQualityMode.ADAPTIVE,
      trainingEnabled: true
    });

    expect(result.safePlanResult.planJson.nutrition.foodPlan).toBe(foodPlan);
    expect(result.safePlanResult.planJson.nutrition.meals[0]).toEqual({
      name: 'Breakfast',
      purpose: 'Steady energy',
      foods: [{ name: 'Oats', portion: '80 g' }]
    });
    expect(result.safePlanResult.planJson.reminders).toContain(
      'recovery-finalized'
    );
    expect(result.safePlanResult.planJson.debug).toEqual(
      expect.objectContaining({
        planQualityMode: PlanQualityMode.ADAPTIVE,
        generation: {
          isComplete: true,
          adjustedSections: []
        },
        exerciseSelection: expect.objectContaining({
          usedAiRetry: true,
          usedDeterministicFallback: false
        })
      })
    );
    expect(result.safePlanResult.planJson.checkpointBaseline).toEqual({
      capturedAt: '2026-07-26T08:00:00.000Z'
    });
    expect(
      dependencies.planCheckpointService.captureGenerationBaseline
    ).toHaveBeenCalledWith('user-1', '2026-07-26', 'plan-1');
    expect(result.finalExerciseIds).toEqual([]);
  });

  it('restores vetted deterministic exercises for a fallback training day', async () => {
    const { service, dependencies } = createService();
    const fallbackPlan = {
      ...createPlan(),
      debug: {
        ...createPlan().debug!,
        provider: 'fallback' as const,
        generatedBy: 'SafeFallbackPlanFactory' as const
      }
    };
    dependencies.trainingPlanAgent.composeDeterministicFallback.mockImplementation(
      (planJson: DailyPlanJson) => ({
        ...planJson,
        training: {
          ...planJson.training,
          exercises: [
            {
              exerciseId: 'bodyweight-squat',
              name: 'Bodyweight squat'
            }
          ]
        }
      })
    );

    const result = await service.finalize({
      userId: 'user-1',
      planLocalDate: '2026-07-26',
      safePlanResult: {
        status: PlanStatus.FALLBACK,
        planJson: fallbackPlan
      },
      finalFoodPlan: createFoodPlan(),
      trainingPreparation: {
        status: PlanStatus.FALLBACK,
        planJson: fallbackPlan,
        usedAiRetry: false,
        usedDeterministicFallback: true
      },
      exerciseSelection: createExerciseSelection(),
      resolvedTrainingDay: createResolvedTrainingDay(true),
      nutritionTarget: { id: 'target' } as never,
      planQualityMode: PlanQualityMode.BASIC,
      trainingEnabled: true
    });

    expect(
      dependencies.trainingPlanAgent.composeDeterministicFallback
    ).toHaveBeenCalledTimes(1);
    expect(result.finalExerciseIds).toEqual(['bodyweight-squat']);
    expect(
      result.safePlanResult.planJson.debug?.generation?.adjustedSections
    ).toEqual(
      expect.arrayContaining(['CORE', 'TRAINING', 'RECOVERY'])
    );
  });
});

function createService() {
  const nutritionTargetsService = {
    toSnapshot: jest.fn().mockReturnValue({
      source: 'nutrition-target'
    })
  };
  const planCheckpointService = {
    captureGenerationBaseline: jest.fn().mockResolvedValue({
      capturedAt: '2026-07-26T08:00:00.000Z'
    })
  };
  const recoveryPlanAgent = {
    finalizeGeneratedPlan: jest.fn(({ planJson }: { planJson: DailyPlanJson }) => ({
      planJson: {
        ...planJson,
        reminders: [...planJson.reminders, 'recovery-finalized']
      },
      mode: 'NORMAL',
      contextApplied: true
    }))
  };
  const trainingPlanAgent = {
    composeDeterministicFallback: jest.fn()
  };
  const service = new DailyPlanFinalizationService(
    nutritionTargetsService as never,
    planCheckpointService as never,
    recoveryPlanAgent as never,
    trainingPlanAgent as never
  );

  return {
    service,
    dependencies: {
      nutritionTargetsService,
      planCheckpointService,
      trainingPlanAgent
    }
  };
}

function createPlan() {
  return createMockDailyPlan({
    planLocalDate: '2026-07-26',
    planTimezone: 'UTC',
    isMinor: false
  });
}

function createFoodPlan() {
  return {
    meals: [
      {
        title: 'Breakfast',
        shortDescription: 'Steady energy',
        servingSummary: 'One serving',
        ingredients: [
          {
            name: 'Oats',
            quantity: 80,
            unit: 'g'
          }
        ]
      }
    ]
  } as unknown as NonNullable<
    DailyPlanJson['nutrition']['foodPlan']
  >;
}

function createResolvedTrainingDay(isTrainingDay: boolean) {
  return {
    source: isTrainingDay ? 'WEEKLY_SCHEDULE' : 'NO_TRAINING',
    localDate: '2026-07-26',
    dayOfWeek: 'SUNDAY',
    isTrainingDay,
    targetMuscles: isTrainingDay ? ['QUADRICEPS'] : [],
    environment: isTrainingDay ? 'HOME' : null,
    availableEquipment: isTrainingDay ? ['BODYWEIGHT'] : [],
    durationMinutes: isTrainingDay ? 45 : 0
  } as never;
}

function createExerciseSelection() {
  return {
    candidates: [],
    requestedExerciseCount: 3,
    minExerciseCount: 2,
    maxExerciseCount: 4,
    candidatePoolLimit: 6,
    workoutDurationMinutes: 45,
    volumePlan: {
      targetExerciseCount: 3,
      minExerciseCount: 2,
      maxExerciseCount: 4,
      suggestedSetsPerExercise: 3,
      suggestedRestSeconds: 60,
      estimatedSessionMinutes: 40,
      warmupMinutes: 5,
      cooldownMinutes: 5,
      transitionSecondsPerExercise: 30,
      volumeReasonCodes: []
    },
    normalizedTargetMuscles: ['QUADRICEPS'],
    fallbackMode: 'NONE',
    internalExclusionSummary: {}
  } as never;
}
