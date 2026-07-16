import { PlanQualityMode } from '@prisma/client';

import type { FoodCatalogSelectionRole } from '../food-catalog/food-catalog.types';
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
 * Returns a soft candidate-ranking preference only after at least two skipped
 * meals. The target and restriction rules remain unchanged.
 */
export function foodAdherencePracticalityRoles(input: NutritionAgentInput) {
  if (input.planQualityMode === PlanQualityMode.BASIC) return [];
  if ((input.foodAdherenceSummary?.skippedMealCount ?? 0) < 2) return [];

  const mostFrequentlySkipped = input.foodAdherenceSummary?.commonSkippedMealTypes[0];
  return mostFrequentlySkipped ? MEAL_TYPE_ROLES[mostFrequentlySkipped] ?? [] : [];
}
