import type { DailyFoodPlan, FoodNutritionTotals } from '@optime/shared-types';

/**
 * Makes calculated ingredient nutrition the single source of truth for the
 * public food-plan totals. Provider copy never owns these values.
 */
export function normalizeFoodPlanNutrition(foodPlan: DailyFoodPlan): DailyFoodPlan {
  const meals = foodPlan.meals.map((meal) => ({
    ...meal,
    ...sumNutrition(meal.ingredients)
  }));

  return {
    ...foodPlan,
    meals,
    totals: sumNutrition(meals)
  };
}

function sumNutrition(items: Array<FoodNutritionTotals>): FoodNutritionTotals {
  return items.reduce<FoodNutritionTotals>(
    (totals, item) => ({
      caloriesKcal: totals.caloriesKcal + item.caloriesKcal,
      proteinGrams: totals.proteinGrams + item.proteinGrams,
      carbsGrams: totals.carbsGrams + item.carbsGrams,
      fatGrams: totals.fatGrams + item.fatGrams
    }),
    { caloriesKcal: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 }
  );
}
