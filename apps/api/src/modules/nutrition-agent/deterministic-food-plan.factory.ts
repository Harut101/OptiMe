import type {
  DailyFoodPlan,
  FoodIngredientUnit,
  FoodMeal,
  FoodMealType,
  FoodSubstitutionReasonCode
} from '@optime/shared-types';

import { FOOD_PLAN_VALIDATION_TOLERANCES } from './food-plan-validation.constants';
import type { NutritionAgentInput } from './nutrition-agent.types';

export function createDeterministicFoodPlan(
  input: NutritionAgentInput,
  source: DailyFoodPlan['source'],
  reasons: string[] = []
): DailyFoodPlan {
  const target = input.nutritionTarget;
  const mealCount = normalizeMealCount(input.nutritionPreference?.mealsPerDay);
  const totals = target.safety.status === 'NEEDS_MORE_INFO'
    ? { caloriesKcal: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 }
    : {
        caloriesKcal: target.calories.targetKcal,
        proteinGrams: target.macros.proteinGrams,
        carbsGrams: target.macros.carbsGrams,
        fatGrams: target.macros.fatGrams
      };
  const splits = getMealSplits(mealCount);
  const restrictedFoods = [
    ...(input.nutritionPreference?.allergies ?? []),
    ...(input.nutritionPreference?.excludedFoods ?? [])
  ];
  const safePreferredFoods = (input.nutritionPreference?.preferredFoods ?? []).filter(
    (food) => isSafePreferredFood(food, restrictedFoods)
  );
  const meals = splits.map((split, index) =>
    createMeal({
      index,
      mealCount,
      split,
      totals,
      preferredFood: safePreferredFoods[index],
      restrictedFoods,
      trainingDay: target.dayType === 'TRAINING_DAY'
    })
  );

  return {
    source,
    localDate: input.planLocalDate,
    locale: input.locale,
    nutritionTargetSnapshot: input.nutritionTargetSnapshot,
    totals: roundTotals(totals),
    validation: {
      status: source === 'DETERMINISTIC_FALLBACK' ? 'FALLBACK' : 'VALID',
      reasons,
      tolerances: {
        caloriesPercent: FOOD_PLAN_VALIDATION_TOLERANCES.caloriesPercent,
        proteinGrams: FOOD_PLAN_VALIDATION_TOLERANCES.proteinGrams,
        carbsGrams: FOOD_PLAN_VALIDATION_TOLERANCES.carbsGrams,
        fatGrams: FOOD_PLAN_VALIDATION_TOLERANCES.fatGrams
      }
    },
    meals
  };
}

function createMeal(input: {
  index: number;
  mealCount: number;
  split: number;
  totals: { caloriesKcal: number; proteinGrams: number; carbsGrams: number; fatGrams: number };
  preferredFood?: string;
  restrictedFoods: string[];
  trainingDay: boolean;
}): FoodMeal {
  const mealType = getMealType(input.index, input.mealCount, input.trainingDay);
  const totals = roundTotals({
    caloriesKcal: input.totals.caloriesKcal * input.split,
    proteinGrams: input.totals.proteinGrams * input.split,
    carbsGrams: input.totals.carbsGrams * input.split,
    fatGrams: input.totals.fatGrams * input.split
  });
  const title = getMealTitle(mealType);
  const ingredientName = getSafeFallbackIngredientName({
    preferredFood: input.preferredFood,
    title,
    restrictedFoods: input.restrictedFoods
  });

  return {
    id: `${mealType.toLowerCase()}-${input.index + 1}`,
    mealType,
    title,
    shortDescription: 'A simple meal built around today\'s target.',
    ...totals,
    prepTimeMinutes: input.index === 0 ? 10 : 15,
    servingSummary: '1 balanced serving',
    ingredients: [
      {
        name: ingredientName,
        quantity: 1,
        unit: 'serving' as FoodIngredientUnit,
        ...totals,
        isOptional: false
      }
    ],
    preparationSteps: [
      'Build the meal from familiar foods that fit your preferences.',
      'Keep the portion close to the serving summary and adjust only for comfort.'
    ],
    substitutions: [
      {
        originalItem: ingredientName,
        replacementItem: 'Similar preferred protein and carbohydrate option',
        servingSummary: '1 comparable serving',
        reasonCode: 'SIMILAR_MACROS' as FoodSubstitutionReasonCode,
        macroImpactNote: 'Aim to keep calories and macros close to the listed meal.'
      }
    ],
    explanation: {
      reasonCodes: [
        'TARGET_ALIGNED',
        input.trainingDay ? 'TRAINING_SUPPORT' : 'BALANCED_ENERGY',
        'SIMPLE_PREP'
      ]
    }
  };
}

function normalizeMealCount(value?: number | null) {
  if (!Number.isFinite(value ?? NaN)) return 3;
  return Math.min(Math.max(Math.trunc(value!), 1), 6);
}

function getMealSplits(mealCount: number) {
  if (mealCount === 1) return [1];
  if (mealCount === 2) return [0.45, 0.55];
  if (mealCount === 3) return [0.3, 0.35, 0.35];
  if (mealCount === 4) return [0.25, 0.3, 0.3, 0.15];
  if (mealCount === 5) return [0.22, 0.26, 0.26, 0.13, 0.13];
  return [0.2, 0.23, 0.23, 0.12, 0.11, 0.11];
}

function getMealType(index: number, mealCount: number, trainingDay: boolean): FoodMealType {
  if (trainingDay && mealCount >= 4 && index === mealCount - 1) return 'POST_WORKOUT';
  const sequence: FoodMealType[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'SNACK', 'SNACK'];
  return sequence[index] ?? 'SNACK';
}

function getMealTitle(mealType: FoodMealType) {
  const titles: Record<FoodMealType, string> = {
    BREAKFAST: 'Breakfast',
    LUNCH: 'Lunch',
    DINNER: 'Dinner',
    SNACK: 'Snack',
    PRE_WORKOUT: 'Pre-workout snack',
    POST_WORKOUT: 'Post-workout meal'
  };

  return titles[mealType];
}

function roundTotals<T extends { caloriesKcal: number; proteinGrams: number; carbsGrams: number; fatGrams: number }>(
  totals: T
) {
  return {
    caloriesKcal: Math.round(totals.caloriesKcal),
    proteinGrams: Math.round(totals.proteinGrams),
    carbsGrams: Math.round(totals.carbsGrams),
    fatGrams: Math.round(totals.fatGrams)
  };
}

function sameFood(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * A user can exclude a previously generated placeholder ingredient. Fallback
 * content must never recreate that same placeholder on a later plan refresh.
 */
function isSafePreferredFood(food: string, restrictedFoods: string[]) {
  const preferred = food.trim();

  if (!preferred) {
    return false;
  }

  return ![
    preferred,
    `Balanced ${preferred} plate`
  ].some((candidate) => containsRestrictedFood(candidate, restrictedFoods));
}

function getSafeFallbackIngredientName(input: {
  preferredFood?: string;
  title: string;
  restrictedFoods: string[];
}) {
  const preferred = input.preferredFood?.trim();
  const candidates = [
    preferred ? `Balanced ${preferred} plate` : null,
    `${input.title} balanced plate`,
    'Balanced meal',
    'Meal components'
  ].filter((candidate): candidate is string => Boolean(candidate));

  return candidates.find((candidate) => !containsRestrictedFood(candidate, input.restrictedFoods))
    ?? 'Meal components';
}

function containsRestrictedFood(candidate: string, restrictedFoods: string[]) {
  return restrictedFoods.some((restrictedFood) => {
    const normalized = restrictedFood.trim().toLowerCase();

    if (!normalized) {
      return false;
    }

    return new RegExp(`(^|\\b)${escapeRegExp(normalized)}(\\b|$)`, 'i').test(candidate.trim());
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
