import type { TFunction } from 'i18next';
import type {
  FoodDayLogResponse,
  FoodMeal,
  FoodMealProgressResponse,
  FoodMealProgressStatus
} from '@/types/api';

export const FOOD_STATUSES: FoodMealProgressStatus[] = [
  'PLANNED',
  'EATEN',
  'PARTIALLY_EATEN',
  'SKIPPED'
];

export function getMealProgress(
  foodLog: FoodDayLogResponse | undefined,
  mealId: string
) {
  return foodLog?.mealProgress.find((progress) => progress.mealId === mealId) ?? null;
}

export function getMealStatus(
  foodLog: FoodDayLogResponse | undefined,
  mealId: string
): FoodMealProgressStatus {
  return getMealProgress(foodLog, mealId)?.status ?? 'PLANNED';
}

export function getMealStatusLabel(status: FoodMealProgressStatus, t: TFunction) {
  const key = {
    PLANNED: 'foodTracking.statusPlanned',
    EATEN: 'foodTracking.statusEaten',
    PARTIALLY_EATEN: 'foodTracking.statusPartiallyEaten',
    SKIPPED: 'foodTracking.statusSkipped'
  }[status];
  return String(t(key as never));
}

export function getMealStatusActionLabel(status: FoodMealProgressStatus, t: TFunction) {
  const key = {
    PLANNED: 'foodTracking.resetMealStatus',
    EATEN: 'foodTracking.markAsEaten',
    PARTIALLY_EATEN: 'foodTracking.markAsPartiallyEaten',
    SKIPPED: 'foodTracking.markAsSkipped'
  }[status];
  return String(t(key as never));
}

export function formatFoodProgress(foodLog: FoodDayLogResponse | undefined, t: TFunction) {
  if (!foodLog?.supported) return null;
  return String(t('foodTracking.mealsMarked', {
    marked: String(foodLog.markedMealCount),
    total: String(foodLog.plannedMealCount)
  }));
}

export function formatFoodProgressDetail(foodLog: FoodDayLogResponse | undefined, t: TFunction) {
  if (!foodLog?.supported || foodLog.markedMealCount === 0) {
    return String(t('foodTracking.noMealsMarkedYet'));
  }

  const details = [];
  if (foodLog.completedMealCount) {
    details.push(String(t('foodTracking.eatenCount', { count: foodLog.completedMealCount })));
  }
  if (foodLog.partialMealCount) {
    details.push(String(t('foodTracking.partialCount', { count: foodLog.partialMealCount })));
  }
  if (foodLog.skippedMealCount) {
    details.push(String(t('foodTracking.skippedCount', { count: foodLog.skippedMealCount })));
  }

  return details.join(' - ');
}

export function getMealAccessibilityLabel(
  meal: FoodMeal,
  progress: FoodMealProgressResponse | null,
  t: TFunction
) {
  return String(t('foodTracking.mealAccessibility', {
    meal: meal.title,
    status: getMealStatusLabel(progress?.status ?? 'PLANNED', t)
  }));
}
