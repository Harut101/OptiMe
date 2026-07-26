export interface RegenerateDailyFoodPlanInput {
  userId: string;
  dailyPlanId: string;
  reason?: string;
}

export interface RegenerateDailyFoodMealInput
  extends RegenerateDailyFoodPlanInput {
  mealId: string;
}
