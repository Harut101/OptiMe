import {
  GoalImpactMode,
  PlanQualityMode,
  PlanStatus,
  ProgressiveProfilePromptKey
} from '@prisma/client';
import type {
  DailyFoodPlan,
  NutritionTarget
} from '@optime/shared-types';

import type { AiProvider } from '../ai/ai-provider.interface';
import { OpenAiProviderError } from '../ai/open-ai-provider.error';
import { createMockDailyPlan } from '../daily-plans/templates/mock-daily-plan.factory';
import type { ExerciseSelectionResult } from '../exercise-selection/exercise-selection.types';
import type { NutritionAgentService } from '../nutrition-agent/nutrition-agent.service';
import type { NutritionTargetsService } from '../nutrition-targets/nutrition-targets.service';
import type { DailyPlanPlanningUser } from './daily-plan-planning-user';
import { DailyPlanAgentExecutionService } from './daily-plan-agent-execution.service';

describe('DailyPlanAgentExecutionService', () => {
  it('sends a minimal provider context without internal exercise ranking fields', async () => {
    const planJson = createMockDailyPlan({
      planLocalDate: '2026-07-26',
      planTimezone: 'UTC',
      isMinor: false
    });
    const dependencies = createDependencies();
    dependencies.aiProvider.generateDailyPlan.mockResolvedValue(planJson);
    const service = createService(dependencies);

    const result = await service.generateProviderPlan(
      createProviderInput()
    );

    expect(result).toEqual({
      status: PlanStatus.READY,
      planJson
    });
    expect(
      dependencies.aiProvider.generateDailyPlan
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'en-US',
        planLocalDate: '2026-07-26',
        planTimezone: 'UTC',
        exerciseSelection: expect.objectContaining({
          candidates: [
            expect.not.objectContaining({
              internalScore: expect.anything(),
              internalReasonCodes: expect.anything(),
              contraindicationTags: expect.anything(),
              exerciseUpdatedAt: expect.anything()
            })
          ]
        })
      })
    );
  });

  it('returns a normalized fallback for a typed OpenAI provider error', async () => {
    const dependencies = createDependencies();
    dependencies.aiProvider.generateDailyPlan.mockRejectedValue(
      new OpenAiProviderError('invalid response', {
        fallbackReason: 'schema_validation_failed'
      })
    );
    const service = createService(dependencies);

    const result = await service.generateProviderPlan(
      createProviderInput()
    );

    expect(result.status).toBe(PlanStatus.FALLBACK);
    expect(result.planJson).toEqual(
      expect.objectContaining({
        schemaVersion: 'sprint-2.v1',
        contentLocale: 'en-US',
        debug: expect.objectContaining({
          provider: 'fallback',
          fallbackReason: 'schema_validation_failed'
        })
      })
    );
  });

  it('does not hide unexpected provider errors', async () => {
    const dependencies = createDependencies();
    dependencies.aiProvider.generateDailyPlan.mockRejectedValue(
      new Error('unexpected')
    );
    const service = createService(dependencies);

    await expect(
      service.generateProviderPlan(createProviderInput())
    ).rejects.toThrow('unexpected');
  });

  it('builds the existing Nutrition Agent context and returns its food plan', async () => {
    const foodPlan = { meals: [] } as unknown as DailyFoodPlan;
    const targetSnapshot = { source: 'test' };
    const dependencies = createDependencies();
    dependencies.nutritionAgent.generateDailyFoodPlan.mockResolvedValue({
      foodPlan,
      menuOptions: [],
      retryCount: 0,
      fallbackUsed: false,
      validationReasonCodes: []
    });
    dependencies.nutritionTargetsService.toSnapshot.mockReturnValue(
      targetSnapshot
    );
    const service = createService(dependencies);
    const user = createPlanningUser();

    const result = await service.generateFoodPlan({
      user,
      locale: 'en-US',
      planLocalDate: '2026-07-26',
      planQualityMode: PlanQualityMode.PERSONALIZED,
      appMode: GoalImpactMode.NUTRITION_AND_TRAINING,
      nutritionTarget: {} as NutritionTarget,
      personalizationContext: createPersonalizationContext(),
      availableFoodSlugs: ['oats'],
      resolvedTrainingDay: {
        isTrainingDay: true
      } as never
    });

    expect(result).toEqual({
      foodPlan,
      menuOptions: []
    });
    expect(
      dependencies.nutritionAgent.generateDailyFoodPlan
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        safeMode: false,
        isMinor: false,
        nutritionTargetSnapshot: targetSnapshot,
        nutritionPreference: expect.objectContaining({
          allergies: ['Avocado'],
          preferredFoods: ['Oats']
        }),
        goalSummary: {
          primaryGoal: user.goal?.primaryGoal,
          goalType: user.goal?.goalType
        },
        mealPracticalityPreference: {
          cookingTime: 'VERY_QUICK'
        },
        mealTimingPreference: 'EARLIER',
        availableFoodSlugs: ['oats']
      })
    );
  });
});

function createService(dependencies: ReturnType<typeof createDependencies>) {
  return new DailyPlanAgentExecutionService(
    dependencies.aiProvider as unknown as AiProvider,
    dependencies.nutritionAgent as unknown as NutritionAgentService,
    dependencies.nutritionTargetsService as unknown as NutritionTargetsService
  );
}

function createDependencies() {
  return {
    aiProvider: {
      generateDailyPlan: jest.fn()
    },
    nutritionAgent: {
      generateDailyFoodPlan: jest.fn()
    },
    nutritionTargetsService: {
      toSnapshot: jest.fn()
    }
  };
}

function createProviderInput() {
  return {
    user: createPlanningUser(),
    locale: 'en-US' as const,
    planLocalDate: '2026-07-26',
    planTimezone: 'UTC',
    planQualityMode: PlanQualityMode.PERSONALIZED,
    personalizationContext: createPersonalizationContext(),
    exerciseSelection: {
      candidates: [
        {
          exerciseId: 'exercise-1',
          slug: 'bodyweight-squat',
          name: 'Bodyweight squat',
          resolvedLocale: 'en-US',
          category: 'STRENGTH',
          movementPattern: 'SQUAT',
          equipment: [],
          targetMuscles: [],
          secondaryMuscles: [],
          instructions: [],
          coachingCues: [],
          safetyNotes: [],
          contraindicationTags: [],
          hasMedia: true,
          exerciseUpdatedAt: '2026-07-26T00:00:00.000Z',
          internalScore: 10,
          internalReasonCodes: []
        }
      ],
      requestedExerciseCount: 1,
      minExerciseCount: 1,
      maxExerciseCount: 2,
      candidatePoolLimit: 4,
      workoutDurationMinutes: 30,
      volumePlan: {
        targetExerciseCount: 1,
        minExerciseCount: 1,
        maxExerciseCount: 2,
        suggestedSetsPerExercise: 2,
        suggestedRestSeconds: 60,
        estimatedSessionMinutes: 30,
        warmupMinutes: 5,
        cooldownMinutes: 5,
        transitionSecondsPerExercise: 30,
        volumeReasonCodes: []
      },
      normalizedTargetMuscles: [],
      fallbackMode: 'NONE',
      internalExclusionSummary: {}
    } as unknown as ExerciseSelectionResult
  };
}

function createPersonalizationContext() {
  return {
    mode: PlanQualityMode.PERSONALIZED,
    contextLevel: 'personalized' as const,
    guidance: [],
    appMode: GoalImpactMode.NUTRITION_AND_TRAINING,
    trainingEnabled: true,
    foodAdherenceSummary: {
      daysWithTrackedMeals: 1,
      markedMealCount: 3,
      completedMealCount: 2,
      partialMealCount: 1,
      skippedMealCount: 0,
      commonSkippedMealTypes: []
    },
    trainingPersonalization: {
      usesSchedule: true,
      usesTrainingDescriptions: true,
      exerciseDetailLevel: 'sets_reps_rest' as const,
      futureSignals: []
    }
  };
}

function createPlanningUser() {
  return {
    id: 'user-1',
    firstName: 'Alex',
    timezone: 'UTC',
    locale: 'en-US',
    isMinor: false,
    safeMode: false,
    noTrainingPlanned: false,
    privacyConsentedAt: new Date(),
    settings: null,
    profile: null,
    goal: {
      goalType: 'GENERAL_WELLNESS',
      primaryGoal: 'HEALTHY_EATING',
      targetWeightKg: null,
      targetTimelineDays: null,
      impactMode: GoalImpactMode.NUTRITION_AND_TRAINING
    },
    nutritionPref: {
      dietType: 'BALANCED',
      mealsPerDay: 3,
      notes: null,
      noKnownAllergiesConfirmed: false,
      allergies: [{ name: 'Avocado' }],
      excludedFoods: [],
      dislikedFoods: [],
      preferredFoods: [{ name: 'Oats' }]
    },
    schedules: [],
    weeklyTrainingSchedule: null,
    trainingPreference: null,
    progressiveProfilePrompts: [
      {
        promptKey: ProgressiveProfilePromptKey.COOKING_TIME,
        answerJson: 'VERY_QUICK'
      },
      {
        promptKey: ProgressiveProfilePromptKey.MEAL_TIMING,
        answerJson: 'EARLIER'
      }
    ]
  } as unknown as DailyPlanPlanningUser;
}
