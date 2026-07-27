import {
  FoodPreparationLevel,
  GoalImpactMode,
  PlanQualityMode
} from '@prisma/client';
import type { DailyFoodPlan } from '@optime/shared-types';

import type { PrismaService } from '../../prisma/prisma.service';
import type { FoodIngredientSwapService } from '../daily-plans/food-ingredient-swap.service';
import type { FoodPlanValidationService } from '../nutrition-agent/food-plan-validation.service';
import {
  type DailyPlanFoodContext,
  type DailyPlanFoodContextService
} from './daily-plan-food-context.service';
import { DailyPlanFoodIngredientUseCaseService } from './daily-plan-food-ingredient-use-case.service';

describe('DailyPlanFoodIngredientUseCaseService', () => {
  it('returns catalog suggestions with all current food restrictions', async () => {
    const dependencies = createDependencies();
    const service = createService(dependencies);
    const context = createContext();
    const suggestions = [createSuggestion()];
    dependencies.foodContextService.getContext.mockResolvedValue(
      context
    );
    dependencies.foodIngredientSwapService.getSuggestions.mockResolvedValue(
      suggestions
    );

    const result = await service.getSwapSuggestions({
      userId: 'user-1',
      dailyPlanId: 'plan-1',
      mealId: 'breakfast',
      ingredientSlug: 'oats'
    });

    expect(result).toEqual({
      dailyPlanId: 'plan-1',
      mealId: 'breakfast',
      ingredientSlug: 'oats',
      suggestions
    });
    expect(
      dependencies.foodIngredientSwapService.getSuggestions
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        restrictions: {
          allergies: ['peanut'],
          excludedFoods: ['pork'],
          dislikedFoods: ['mushroom']
        }
      })
    );
  });

  it('rejects a replacement that is no longer in the safe suggestion set', async () => {
    const dependencies = createDependencies();
    const service = createService(dependencies);
    dependencies.foodContextService.getContext.mockResolvedValue(
      createContext()
    );
    dependencies.foodIngredientSwapService.getSuggestions.mockResolvedValue(
      []
    );

    await expect(
      service.applySwap({
        userId: 'user-1',
        dailyPlanId: 'plan-1',
        mealId: 'breakfast',
        ingredientSlug: 'oats',
        replacementCatalogFoodSlug: 'unsafe-food'
      })
    ).rejects.toThrow(
      'This ingredient alternative is no longer safe for your current food preferences.'
    );
    expect(
      dependencies.foodPlanValidator.validate
    ).not.toHaveBeenCalled();
    expect(
      dependencies.foodContextService.persistFoodPlan
    ).not.toHaveBeenCalled();
  });

  it('validates and persists a safe ingredient replacement', async () => {
    const dependencies = createDependencies();
    const service = createService(dependencies);
    const context = createContext();
    dependencies.foodContextService.getContext.mockResolvedValue(
      context
    );
    dependencies.foodIngredientSwapService.getSuggestions.mockResolvedValue(
      [createSuggestion()]
    );
    dependencies.foodPlanValidator.validate.mockReturnValue({
      passed: true,
      reasons: []
    } as never);
    dependencies.foodContextService.persistFoodPlan.mockResolvedValue(
      { id: 'updated-plan' } as never
    );

    const result = await service.applySwap({
      userId: 'user-1',
      dailyPlanId: 'plan-1',
      mealId: 'breakfast',
      ingredientSlug: 'oats',
      replacementCatalogFoodSlug: 'quinoa-cooked'
    });

    expect(result).toEqual({ id: 'updated-plan' });
    expect(
      dependencies.foodPlanValidator.validate
    ).toHaveBeenCalledTimes(1);
    expect(
      dependencies.foodContextService.persistFoodPlan
    ).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        meals: [
          expect.objectContaining({
            ingredients: [
              expect.objectContaining({
                catalogFoodSlug: 'quinoa-cooked',
                isOptional: true,
                role: 'BASE',
                measurementState: 'COOKED',
                preparation: 'Measure after cooking.',
                usage: 'Use as the meal base.'
              })
            ],
            substitutions: [
              expect.objectContaining({
                originalItem: 'Oats',
                replacementItem: 'Quinoa'
              })
            ]
          })
        ]
      })
    );
  });

  it('keeps ingredient exclusion duplicate-safe', async () => {
    const dependencies = createDependencies();
    const service = createService(dependencies);
    const preference = {
      id: 'preference-1',
      excludedFoods: [{ name: 'Oats' }]
    };
    dependencies.prisma.dailyPlan.findFirst.mockResolvedValue({
      id: 'plan-1'
    } as never);
    dependencies.transaction.nutritionPreference.upsert.mockResolvedValue(
      { id: 'preference-1' } as never
    );
    dependencies.transaction.excludedFood.findFirst.mockResolvedValue(
      { id: 'excluded-1' } as never
    );
    dependencies.transaction.nutritionPreference.findUniqueOrThrow.mockResolvedValue(
      preference as never
    );

    const result = await service.excludeIngredient({
      userId: 'user-1',
      dailyPlanId: 'plan-1',
      ingredientName: '  Oats  '
    });

    expect(result).toEqual(preference);
    expect(
      dependencies.transaction.excludedFood.findFirst
    ).toHaveBeenCalledWith({
      where: {
        nutritionPreferenceId: 'preference-1',
        name: {
          equals: 'Oats',
          mode: 'insensitive'
        }
      }
    });
    expect(
      dependencies.transaction.excludedFood.create
    ).not.toHaveBeenCalled();
  });
});

function createService(
  dependencies: ReturnType<typeof createDependencies>
) {
  return new DailyPlanFoodIngredientUseCaseService(
    dependencies.prisma as unknown as PrismaService,
    dependencies.foodContextService,
    dependencies.foodIngredientSwapService,
    dependencies.foodPlanValidator
  );
}

function createDependencies() {
  const transaction = {
    nutritionPreference: {
      upsert: jest.fn(),
      findUniqueOrThrow: jest.fn()
    },
    excludedFood: {
      findFirst: jest.fn(),
      create: jest.fn()
    }
  };
  const prisma = {
    dailyPlan: {
      findFirst: jest.fn()
    },
    $transaction: jest.fn(
      (callback: (tx: typeof transaction) => unknown) =>
        callback(transaction)
    )
  };

  return {
    prisma,
    transaction,
    foodContextService: {
      getContext: jest.fn(),
      persistFoodPlan: jest.fn()
    } as unknown as jest.Mocked<DailyPlanFoodContextService>,
    foodIngredientSwapService: {
      getSuggestions: jest.fn()
    } as unknown as jest.Mocked<FoodIngredientSwapService>,
    foodPlanValidator: {
      validate: jest.fn()
    } as unknown as jest.Mocked<FoodPlanValidationService>
  };
}

function createContext(): DailyPlanFoodContext {
  const currentFoodPlan = createFoodPlan();

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
        allergies: [{ name: 'peanut' }],
        excludedFoods: [{ name: 'pork' }],
        dislikedFoods: [{ name: 'mushroom' }],
        preferredFoods: []
      }
    },
    plan: {
      id: 'plan-1',
      planLocalDate: '2026-07-26',
      planTimezone: 'UTC'
    },
    locale: 'en-US',
    currentPlanJson: {},
    currentFoodPlan,
    nutritionTarget: {
      calories: { targetKcal: 500 }
    },
    nutritionTargetSnapshot:
      currentFoodPlan.nutritionTargetSnapshot,
    resolvedTrainingDay: { isTrainingDay: false },
    planQualityMode: PlanQualityMode.BASIC,
    appMode: GoalImpactMode.NUTRITION_ONLY,
    personalizationContext: {},
    blockedFoods: {
      allergies: ['peanut'],
      excludedFoods: ['pork']
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
      targetKcal: 500,
      minKcal: 450,
      maxKcal: 550,
      maintenanceEstimateKcal: 500,
      proteinGrams: 20,
      carbsGrams: 80,
      fatGrams: 10,
      safetyStatus: 'OK',
      safetyReasons: [],
      explanation: {
        titleCode: 'TODAY_TARGET',
        reasonCodes: []
      }
    },
    totals: {
      caloriesKcal: 380,
      proteinGrams: 15,
      carbsGrams: 60,
      fatGrams: 8
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
      {
        id: 'breakfast',
        mealType: 'BREAKFAST',
        title: 'Oat breakfast',
        shortDescription: 'Oats',
        prepTimeMinutes: 10,
        servingSummary: '1 serving',
        caloriesKcal: 380,
        proteinGrams: 15,
        carbsGrams: 60,
        fatGrams: 8,
        ingredients: [
          {
            catalogFoodSlug: 'oats',
            name: 'Oats',
            quantity: 100,
            unit: 'g',
            caloriesKcal: 380,
            proteinGrams: 15,
            carbsGrams: 60,
            fatGrams: 8,
            isOptional: true
          }
        ],
        preparationSteps: [],
        substitutions: [],
        explanation: {
          reasonCodes: ['TARGET_ALIGNED']
        }
      }
    ]
  };
}

function createSuggestion() {
  return {
    slug: 'quinoa-cooked',
    name: 'Quinoa',
    quantity: 315,
    unit: 'g' as const,
    caloriesKcal: 378,
    proteinGrams: 13.8,
    carbsGrams: 67,
    fatGrams: 6,
    preparationLevel: FoodPreparationLevel.QUICK_ASSEMBLY,
    role: 'BASE' as const,
    measurementState: 'COOKED' as const,
    preparation: 'Measure after cooking.',
    usage: 'Use as the meal base.'
  };
}
