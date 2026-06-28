import { apiRequest } from './client';
import type {
  FoodDayLogResponse,
  FoodMealProgressStatus,
  UpdateFoodMealStatusRequest
} from '@/types/api';

export function getFoodLog(dailyPlanId: string) {
  return apiRequest<FoodDayLogResponse>(`/daily-plans/${dailyPlanId}/food-log`);
}

export function updateFoodMealStatus(
  dailyPlanId: string,
  mealId: string,
  status: FoodMealProgressStatus
) {
  const body: UpdateFoodMealStatusRequest = { status };
  return apiRequest<FoodDayLogResponse>(`/daily-plans/${dailyPlanId}/food-log/meals/${mealId}/status`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}
