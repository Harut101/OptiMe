import {
  GoalImpactMode,
  PlanQualityMode,
  UsageFeature
} from '@prisma/client';
import type { DailyFoodPlan } from '@optime/shared-types';

import type { AiCostControlService } from '../ai-operation-logs/ai-cost-control.service';
import type { FoodAvailabilityService } from '../food-availability/food-availability.service';
import type { NutritionAgentService } from '../nutrition-agent/nutrition-agent.service';
import type { UsageGuardService } from '../usage/usage-guard.service';
import type {
  DailyPlanFoodContext,
  DailyPlanFoodContextService
} from './daily-plan-food-context.service';
import { DailyPlanFoodRegenerationUseCaseService } from './daily-plan-food-regeneration-use-case.service';

describe('DailyPlanFoodRegenerationUseCaseService', () => {
  it('owns full-menu usage, generation, and persistence', async () => {
    const dependencies = createDependencies();
    const service = createService(dependencies);
    const foodPlan = createFoodPlan();
    dependencies.nutritionAgent.generateDailyFoodPlan.mockResolvedValue(
      {
        foodPlan,
        retryCount: 0,
        fallbackUsed: false,
        validationReasonCodes: []
      }
    );

    const result = await service.regenerateMenu({
      userId: 'user-1',
      dailyPlanId: 'plan-1',
      reason: 'More variety'
    });

    expect(result).toEqual({ id: 'updated-plan' });
    expect(
      dependencies.usageGuardService.checkAndConsumeConfigured
    ).toHaveBeenCalledWith(
      'user-1',
      UsageFeature.MENU_REGENERATION
    );
    expect(
      dependencies.nutritionAgent.generateDailyFoodPlan
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        regeneration: expect.objectContaining({
          mode: 'FULL_MENU_REGENERATION',
          reason: 'More variety',
          existingFoodPlan:
            dependencies.context.currentFoodPlan
        })
      })
    );
    expect(
      dependencies.foodContextService.persistFoodPlan
    ).toHaveBeenCalledWith(
      dependencies.context,
      expect.objectContaining({
        meals: [
          expect.objectContaining({
            shortDescription: expect.stringContaining(
              'Menu refreshed'
            )
          }),
          expect.objectContaining({
            shortDescription: expect.stringContaining(
              'Menu refreshed'
            )
          })
        ]
      })
    );
  });

  it('marks only the selected regenerated meal', async () => {
    const dependencies = createDependencies();
    const service = createService(dependencies);
    dependencies.nutritionAgent.generateDailyFoodPlan.mockResolvedValue(
      {
        foodPlan: createFoodPlan(),
        retryCount: 1,
        fallbackUsed: false,
        validationReasonCodes: []
      }
    );

    await service.regenerateMeal({
      userId: 'user-1',
      dailyPlanId: 'plan-1',
      mealId: 'lunch',
      reason: 'Quicker prep'
    });

    expect(
      dependencies.usageGuardService.checkAndConsumeConfigured
    ).toHaveBeenCalledWith(
      'user-1',
      UsageFeature.MEAL_REGENERATION
    );
    const persistedFoodPlan =
      dependencies.foodContextService.persistFoodPlan.mock
        .calls[0][1];
    expect(persistedFoodPlan.meals[0].shortDescription).toBe(
      'Breakfast'
    );
    expect(persistedFoodPlan.meals[1].shortDescription).toContain(
      'Meal refreshed'
    );
  });

  it('does not consume usage when the selected meal is absent', async () => {
    const dependencies = createDependencies();
    const service = createService(dependencies);

    await expect(
      service.regenerateMeal({
        userId: 'user-1',
        dailyPlanId: 'plan-1',
        mealId: 'missing'
      })
    ).rejects.toThrow('Meal not found in this plan.');
    expect(
      dependencies.usageGuardService.checkAndConsumeConfigured
    ).not.toHaveBeenCalled();
    expect(
      dependencies.nutritionAgent.generateDailyFoodPlan
    ).not.toHaveBeenCalled();
  });

  it('refunds usage when safe regeneration cannot be produced', async () => {
    const dependencies = createDependencies();
    const service = createService(dependencies);
    dependencies.nutritionAgent.generateDailyFoodPlan.mockResolvedValue(
      {
        foodPlan: {
          ...createFoodPlan(),
          validation: {
            ...createFoodPlan().validation,
            status: 'FALLBACK'
          }
        },
        retryCount: 1,
        fallbackUsed: true,
        validationReasonCodes: ['SAFE_FALLBACK_REQUIRED']
      }
    );

    await expect(
      service.regenerateMenu({
        userId: 'user-1',
        dailyPlanId: 'plan-1'
      })
    ).rejects.toThrow(
      'Could not safely regenerate this meal plan. Your current plan was kept.'
    );
    expect(
      dependencies.usageGuardService.refundById
    ).toHaveBeenCalledWith('usage-1', 1);
    expect(
      dependencies.foodContextService.persistFoodPlan
    ).not.toHaveBeenCalled();
  });
});

function createService(
  dependencies: ReturnType<typeof createDependencies>
) {
  return new DailyPlanFoodRegenerationUseCaseService(
    dependencies.foodContextService,
    dependencies.foodAvailabilityService,
    dependencies.nutritionAgent,
    dependencies.usageGuardService,
    dependencies.aiCostControlService as unknown as AiCostControlService
  );
}

function createDependencies() {
  const context = createContext();
  const foodContextService = {
    getContext: jest.fn().mockResolvedValue(context),
    persistFoodPlan: jest
      .fn()
      .mockResolvedValue({ id: 'updated-plan' })
  } as unknown as jest.Mocked<DailyPlanFoodContextService>;
  const foodAvailabilityService = {
    getAvailableFoodSlugs: jest
      .fn()
      .mockResolvedValue(['oats', 'rice'])
  } as unknown as jest.Mocked<FoodAvailabilityService>;
  const nutritionAgent = {
    generateDailyFoodPlan: jest.fn()
  } as unknown as jest.Mocked<NutritionAgentService>;
  const usageGuardService = {
    checkAndConsumeConfigured: jest
      .fn()
      .mockResolvedValue({ id: 'usage-1' }),
    refundById: jest.fn().mockResolvedValue(undefined)
  } as unknown as jest.Mocked<UsageGuardService>;
  const aiCostControlService = {
    assertCanStartAiOperation: jest.fn()
  };

  return {
    context,
    foodContextService,
    foodAvailabilityService,
    nutritionAgent,
    usageGuardService,
    aiCostControlService
  };
}

function createContext(): DailyPlanFoodContext {
  const foodPlan = createFoodPlan();

  return {
    user: {
      id: 'user-1',
      safeMode: false,
      isMinor: false,
      profile: { pregnancyStatus: 'NOT_PREGNANT' },
      nutritionPref: {
        dietType: 'NONE',
        mealsPerDay: 3,
        notes: null,
        allergies: [],
        excludedFoods: [],
        dislikedFoods: [],
        preferredFoods: []
      },
      goal: {
        primaryGoal: 'HEALTHY_EATING',
        goalType: 'WELLNESS'
      },
      progressiveProfilePrompts: []
    },
    plan: {
      id: 'plan-1',
      planLocalDate: '2026-07-26',
      planTimezone: 'UTC'
    },
    locale: 'en-US',
    currentPlanJson: {},
    currentFoodPlan: foodPlan,
    nutritionTarget: {
      calories: { targetKcal: 2000 }
    },
    nutritionTargetSnapshot: foodPlan.nutritionTargetSnapshot,
    resolvedTrainingDay: { isTrainingDay: false },
    planQualityMode: PlanQualityMode.BASIC,
    appMode: GoalImpactMode.NUTRITION_ONLY,
    personalizationContext: {
      foodAdherenceSummary: null
    },
    blockedFoods: {
      allergies: [],
      excludedFoods: []
    }
  } as unknown as DailyPlanFoodContext;
}

function createFoodPlan(): DailyFoodPlan {
  return {
    source: 'NUTRITION_AGENT',
    localDate: '2026-07-26',
    locale: 'en-US',
    nutritionTargetSnapshot: {
      engineVersion: 1,
      localDate: '2026-07-26',
      dayType: 'REST_DAY',
      appMode: 'NUTRITION_ONLY',
      primaryGoal: 'HEALTHY_EATING',
      targetKcal: 2000,
      minKcal: 1800,
      maxKcal: 2200,
      maintenanceEstimateKcal: 2000,
      proteinGrams: 120,
      carbsGrams: 230,
      fatGrams: 67,
      safetyStatus: 'OK',
      safetyReasons: [],
      explanation: {
        titleCode: 'TODAY_TARGET',
        reasonCodes: []
      }
    },
    totals: {
      caloriesKcal: 2000,
      proteinGrams: 120,
      carbsGrams: 230,
      fatGrams: 67
    },
    validation: {
      status: 'VALID',
      reasons: [],
      tolerances: {
        caloriesPercent: 5,
        proteinGrams: 10,
        carbsGrams: 15,
        fatGrams: 8
      }
    },
    meals: [
      createMeal('breakfast', 'BREAKFAST', 'Breakfast'),
      createMeal('lunch', 'LUNCH', 'Lunch')
    ]
  };
}

function createMeal(
  id: string,
  mealType: 'BREAKFAST' | 'LUNCH',
  shortDescription: string
): DailyFoodPlan['meals'][number] {
  return {
    id,
    mealType,
    title: shortDescription,
    shortDescription,
    prepTimeMinutes: 10,
    servingSummary: '1 serving',
    caloriesKcal: 1000,
    proteinGrams: 60,
    carbsGrams: 115,
    fatGrams: 33.5,
    ingredients: [],
    preparationSteps: [],
    substitutions: [],
    explanation: {
      reasonCodes: ['TARGET_ALIGNED']
    }
  };
}
