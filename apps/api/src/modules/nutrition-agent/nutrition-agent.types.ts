import {
  DietType,
  GoalImpactMode,
  PlanQualityMode,
  PregnancyStatus
} from '@prisma/client';
import type {
  DailyFoodPlan,
  FoodNutritionTotals,
  NutritionTarget,
  NutritionTargetSnapshot,
  ResolvedTrainingDayContext,
  SupportedLocale
} from '@optime/shared-types';
import type { GenerateDailyPlanSafetyFeedback } from '../ai/ai-provider.interface';

export interface NutritionAgentInput {
  userId: string;
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
  // User-confirmed catalog foods that are available on the plan's local date.
  // They are safe ranking hints only, never an inventory or nutrition source.
  availableFoodSlugs?: string[];
  foodRotationContext?: FoodRotationContext;
  safetyFeedback?: GenerateDailyPlanSafetyFeedback;
  regeneration?: {
    mode: 'FULL_MENU_REGENERATION' | 'MEAL_REGENERATION';
    reason?: string;
    existingFoodPlan: DailyFoodPlan;
    selectedMealId?: string;
  };
}

export interface FoodRotationUsage {
  catalogFoodSlug: string;
  occurrenceCount: number;
  daysUsed: number;
  lastUsedLocalDate: string;
  daysSinceLastUse: number;
}

export interface FoodRotationContext {
  lookbackDays: number;
  usage: FoodRotationUsage[];
}

export interface NutritionAgentResult {
  foodPlan: DailyFoodPlan;
  menuOptions: NutritionAgentMenuOption[];
  retryCount: number;
  fallbackUsed: boolean;
  validationReasonCodes: string[];
}

export interface NutritionAgentMenuOption {
  label: string;
  focus: string;
  foodPlan: DailyFoodPlan;
}

export type GeneratedDailyFoodPlan = Pick<
  NutritionAgentResult,
  'foodPlan' | 'menuOptions'
>;

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
  repairFeedback?: FoodPlanRepairFeedback;
}

/** Safe, calculated correction context for one bounded AI retry. */
export interface FoodPlanRepairFeedback {
  reasonCodes: string[];
  targetTotals: FoodNutritionTotals;
  actualTotals?: FoodNutritionTotals;
  deltaFromTarget?: FoodNutritionTotals;
  affectedMealIds: string[];
  instructions: string[];
}
