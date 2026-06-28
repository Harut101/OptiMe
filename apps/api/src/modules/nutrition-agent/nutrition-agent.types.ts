import {
  DietType,
  GoalImpactMode,
  PlanQualityMode,
  PregnancyStatus
} from '@prisma/client';
import type {
  DailyFoodPlan,
  NutritionTarget,
  NutritionTargetSnapshot,
  ResolvedTrainingDayContext,
  SupportedLocale
} from '@optime/shared-types';

export interface NutritionAgentInput {
  planLocalDate: string;
  locale: SupportedLocale;
  planQualityMode: PlanQualityMode;
  appMode: GoalImpactMode;
  safeMode: boolean;
  isMinor: boolean;
  pregnancyStatus?: PregnancyStatus | null;
  nutritionTarget: NutritionTarget;
  nutritionTargetSnapshot: NutritionTargetSnapshot;
  nutritionPreference: {
    dietType: DietType;
    mealsPerDay: number;
    notes: string | null;
    allergies: string[];
    excludedFoods: string[];
    dislikedFoods: string[];
    preferredFoods: string[];
  } | null;
  goalSummary: {
    primaryGoal: string | null;
    goalType: string | null;
  } | null;
  resolvedTrainingDay: ResolvedTrainingDayContext;
  regeneration?: {
    mode: 'FULL_MENU_REGENERATION' | 'MEAL_REGENERATION';
    reason?: string;
    existingFoodPlan: DailyFoodPlan;
    selectedMealId?: string;
  };
}

export interface NutritionAgentResult {
  foodPlan: DailyFoodPlan;
  retryCount: number;
  fallbackUsed: boolean;
  validationReasonCodes: string[];
}

export interface FoodPlanValidationContext {
  nutritionTarget: NutritionTarget;
  nutritionTargetSnapshot: NutritionTargetSnapshot;
  allergies: string[];
  excludedFoods: string[];
  dislikedFoods?: string[];
  safeMode: boolean;
  isMinor: boolean;
  pregnancyStatus?: PregnancyStatus | null;
}

export interface FoodPlanValidationResult {
  passed: boolean;
  reasons: string[];
  totalKcalDelta: number;
}
