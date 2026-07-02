import type { TFunction } from 'i18next';

import { getContextNoteMessage } from '@/features/daily-plan/context-note-copy';
import { formatNumber } from '@/i18n/formatters';
import type {
  DailyPlanJson,
  FoodDayLogResponse,
  GoalResponse,
  WorkoutSessionResponse
} from '@/types/api';

export interface DashboardProgress {
  value: number | null;
  centerLabel?: string;
  subtitle: string;
  hint?: string;
  accessibilityLabel: string;
}

export function resolveNutritionProgress({
  plan,
  foodLog,
  locale,
  t
}: {
  plan?: DailyPlanJson;
  foodLog?: FoodDayLogResponse;
  locale: string;
  t: TFunction;
}): DashboardProgress {
  const meals = plan?.nutrition.foodPlan?.meals ?? [];
  const totalMeals = foodLog?.plannedMealCount || meals.length;

  if (!totalMeals) {
    const subtitle = String(t('todayDashboard.noMealsPlanned'));
    return {
      value: null,
      centerLabel: '-',
      subtitle,
      hint: String(t('todayDashboard.foodLogHelp')),
      accessibilityLabel: `${t('todayDashboard.nutritionProgress')}. ${subtitle}`
    };
  }

  const weightedCompleted = foodLog?.mealProgress.reduce((sum, meal) => {
    if (meal.status === 'EATEN') return sum + 1;
    if (meal.status === 'PARTIALLY_EATEN') return sum + 0.5;
    return sum;
  }, 0) ?? 0;
  const value = Math.round((weightedCompleted / totalMeals) * 100);
  const markedMeals = foodLog?.markedMealCount ?? 0;
  const subtitle = String(t('todayDashboard.mealsTracked', {
    marked: String(markedMeals),
    total: String(totalMeals)
  }));
  const estimatedKcal = estimateTrackedCalories(meals, foodLog);
  const targetKcal = plan?.nutrition.foodPlan?.totals.caloriesKcal
    ?? plan?.nutritionTargetSnapshot?.targetKcal
    ?? null;
  const hint = estimatedKcal !== null && targetKcal
    ? String(t('todayDashboard.caloriesTarget', {
      current: formatNumber(Math.round(estimatedKcal), locale),
      target: formatNumber(Math.round(targetKcal), locale)
    }))
    : String(t('todayDashboard.foodLogHelp'));

  return {
    value,
    subtitle,
    hint,
    accessibilityLabel: `${t('todayDashboard.nutritionProgress')}. ${value}%. ${subtitle}. ${hint}`
  };
}

export function resolveTrainingProgress({
  plan,
  goal,
  workoutSession,
  t
}: {
  plan?: DailyPlanJson;
  goal?: GoalResponse | null;
  workoutSession?: WorkoutSessionResponse | null;
  t: TFunction;
}): DashboardProgress {
  const appMode = goal?.appMode ?? goal?.impactMode ?? 'NUTRITION_AND_TRAINING';

  if (appMode === 'NUTRITION_ONLY') {
    const subtitle = String(t('todayDashboard.trainingDisabled'));
    return {
      value: null,
      centerLabel: String(t('todayDashboard.off')),
      subtitle,
      hint: String(t('today.trainingOffMessage')),
      accessibilityLabel: `${t('todayDashboard.trainingProgress')}. ${subtitle}`
    };
  }

  const exercises = plan?.training.exercises ?? [];
  const isRestDay = plan?.training.intensity === 'REST' || exercises.length === 0;
  const trainingLoadHint = plan?.contextNotes?.trainingLoad
    ? getContextNoteMessage(t, plan.contextNotes.trainingLoad.messageCode)
    : String(t('todayDashboard.controlledIntensity'));

  if (isRestDay) {
    const subtitle = String(t('todayDashboard.restDay'));
    return {
      value: null,
      centerLabel: String(t('todayDashboard.rest')),
      subtitle,
      hint: trainingLoadHint,
      accessibilityLabel: `${t('todayDashboard.trainingProgress')}. ${subtitle}. ${trainingLoadHint}`
    };
  }

  if (workoutSession?.status === 'COMPLETED') {
    const subtitle = String(t('todayDashboard.exercisesDone', {
      completed: String(workoutSession.plannedExerciseCount),
      total: String(workoutSession.plannedExerciseCount)
    }));
    return {
      value: 100,
      subtitle,
      hint: trainingLoadHint,
      accessibilityLabel: `${t('todayDashboard.trainingProgress')}. 100%. ${subtitle}. ${trainingLoadHint}`
    };
  }

  const totalExercises = workoutSession?.plannedExerciseCount || exercises.length;
  const completedExercises = workoutSession?.completedExerciseCount ?? 0;
  const totalSets = workoutSession?.plannedSetCount ?? 0;
  const completedSets = workoutSession?.completedSetCount ?? 0;
  const value = totalSets > 0
    ? Math.round((completedSets / totalSets) * 100)
    : totalExercises > 0
      ? Math.round((completedExercises / totalExercises) * 100)
      : 0;
  const subtitle = String(t('todayDashboard.exercisesDone', {
    completed: String(completedExercises),
    total: String(totalExercises)
  }));

  return {
    value,
    subtitle,
    hint: trainingLoadHint,
    accessibilityLabel: `${t('todayDashboard.trainingProgress')}. ${value}%. ${subtitle}. ${trainingLoadHint}`
  };
}

function estimateTrackedCalories(
  meals: NonNullable<DailyPlanJson['nutrition']['foodPlan']>['meals'],
  foodLog?: FoodDayLogResponse
) {
  if (!meals.length || !foodLog?.mealProgress.length) return null;
  const mealById = new Map(meals.map((meal) => [meal.id, meal]));
  const calories = foodLog.mealProgress.reduce((sum, progress) => {
    const meal = mealById.get(progress.mealId);
    if (!meal) return sum;
    if (progress.status === 'EATEN') return sum + meal.caloriesKcal;
    if (progress.status === 'PARTIALLY_EATEN') return sum + meal.caloriesKcal * 0.5;
    return sum;
  }, 0);

  return calories;
}
