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
  // Aggregate-only signal. It contains no meal names, notes, ingredients, or nutrition data.
  foodAdherenceSummary?: {
    daysWithTrackedMeals: number;
    markedMealCount: number;
    completedMealCount: number;
    partialMealCount: number;
    skippedMealCount: number;
    commonSkippedMealTypes: string[];
  };
  // An explicit, non-sensitive preference answered through the progressive profile.
  // It only adjusts catalog ranking; it never changes targets, portions, or safety rules.
  mealPracticalityPreference?: {
    cookingTime?: 'VERY_QUICK' | 'FIFTEEN_TO_THIRTY' | 'LONGER';
  };
  // A broad preference for distributing food energy through the day. It is not
  // an eating schedule and does not change the daily nutrition target.
  mealTimingPreference?: 'EARLIER' | 'EVENLY_SPACED' | 'LATER' | 'FLEXIBLE';
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
