export interface GetDailyPlanFoodIngredientSwapSuggestionsInput {
  userId: string;
  dailyPlanId: string;
  mealId: string;
  ingredientSlug: string;
}

export interface ApplyDailyPlanFoodIngredientSwapInput
  extends GetDailyPlanFoodIngredientSwapSuggestionsInput {
  replacementCatalogFoodSlug: string;
}

export interface ExcludeDailyPlanFoodIngredientInput {
  userId: string;
  dailyPlanId: string;
  ingredientName: string;
}
