import type { FoodMealType } from '@optime/shared-types';

import type { NutritionAgentInput } from './nutrition-agent.types';

const EARLIER_MULTIPLIERS: Partial<Record<FoodMealType, number>> = {
  BREAKFAST: 1.25,
  LUNCH: 1.05,
  DINNER: 0.8,
  SNACK: 0.9,
  PRE_WORKOUT: 1,
  POST_WORKOUT: 1
};

const LATER_MULTIPLIERS: Partial<Record<FoodMealType, number>> = {
  BREAKFAST: 0.8,
  LUNCH: 1,
  DINNER: 1.25,
  SNACK: 1.05,
  PRE_WORKOUT: 1,
  POST_WORKOUT: 1
};

/**
 * Applies a modest starting portion distribution before the existing daily
 * portion solver restores the user's fixed calorie and macro target. It is not
 * an exact meal-time prescription.
 */
export function mealTimingMultiplier(
  mealType: FoodMealType,
  preference: NutritionAgentInput['mealTimingPreference']
) {
  if (preference === 'EARLIER') return EARLIER_MULTIPLIERS[mealType] ?? 1;
  if (preference === 'LATER') return LATER_MULTIPLIERS[mealType] ?? 1;
  return 1;
}
