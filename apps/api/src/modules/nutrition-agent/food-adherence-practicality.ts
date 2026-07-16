import { PlanQualityMode } from '@prisma/client';

import {
  FOOD_CATALOG_SELECTION_ROLES,
  type FoodCatalogSelectionRole
} from '../food-catalog/food-catalog.types';
import type { NutritionAgentInput } from './nutrition-agent.types';

const MEAL_TYPE_ROLES: Record<string, FoodCatalogSelectionRole[] | undefined> = {
  BREAKFAST: ['BREAKFAST_BASE', 'DAIRY_OR_ALTERNATIVE', 'FRUIT'],
  LUNCH: ['MAIN_PROTEIN', 'CARBOHYDRATE', 'VEGETABLE', 'FAT'],
  DINNER: ['MAIN_PROTEIN', 'CARBOHYDRATE', 'VEGETABLE', 'FAT'],
  SNACK: ['FRUIT', 'DAIRY_OR_ALTERNATIVE', 'FAT'],
  PRE_WORKOUT: ['FRUIT', 'CARBOHYDRATE'],
  POST_WORKOUT: ['MAIN_PROTEIN', 'FRUIT', 'DAIRY_OR_ALTERNATIVE']
};

/**
 * Returns soft candidate-ranking preferences from explicit cooking-time answers
 * and, for paid-quality plans, repeated skipped meals. The target and restriction
 * rules remain unchanged.
 */
export function foodPracticalityRoles(input: NutritionAgentInput) {
  const roles = new Set<FoodCatalogSelectionRole>();

  // This is an explicit preference, so every tier benefits. It is still only a
  // ranking hint: preferred foods and hard restrictions always win.
  if (input.mealPracticalityPreference?.cookingTime === 'VERY_QUICK') {
    FOOD_CATALOG_SELECTION_ROLES.forEach((role) => roles.add(role));
  }

  // Completion-driven adaptation remains a Personalized/Adaptive benefit.
  if (
    input.planQualityMode !== PlanQualityMode.BASIC &&
    (input.foodAdherenceSummary?.skippedMealCount ?? 0) >= 2
  ) {
    const mostFrequentlySkipped = input.foodAdherenceSummary?.commonSkippedMealTypes[0];
    (mostFrequentlySkipped ? MEAL_TYPE_ROLES[mostFrequentlySkipped] : undefined)?.forEach((role) => {
      roles.add(role);
    });
  }

  return [...roles];
}
