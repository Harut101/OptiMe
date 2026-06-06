export type SprintOnePlan = 'FREE';

export interface ApiEnvelope<T> {
  data: T;
}

export type ActivityLevel = 'LOW' | 'LIGHT' | 'MODERATE' | 'HIGH' | 'ATHLETE';
export type GoalType =
  | 'HEALTHY_LIFESTYLE'
  | 'IMPROVE_FITNESS'
  | 'BUILD_MUSCLE'
  | 'IMPROVE_ENDURANCE'
  | 'REDUCE_WEIGHT';
export type GoalImpactMode = 'NUTRITION_ONLY' | 'NUTRITION_AND_TRAINING';
export type DietType =
  | 'NONE'
  | 'OMNIVORE'
  | 'VEGETARIAN'
  | 'VEGAN'
  | 'PESCATARIAN'
  | 'KETO'
  | 'LOW_CARB'
  | 'MEDITERRANEAN'
  | 'HALAL'
  | 'KOSHER';
export type SportType =
  | 'RUNNING'
  | 'CYCLING'
  | 'GYM'
  | 'STRENGTH'
  | 'HIIT'
  | 'YOGA'
  | 'SWIMMING'
  | 'WALKING'
  | 'TEAM_SPORT'
  | 'OTHER';
export type IntensityLevel = 'LOW' | 'MODERATE' | 'HIGH';
export type PregnancyStatus =
  | 'NOT_PREGNANT'
  | 'PREGNANT'
  | 'POSTPARTUM'
  | 'BREASTFEEDING'
  | 'PREFER_NOT_TO_SAY'
  | 'UNKNOWN';

export interface RegisterRequest {
  email: string;
  password: string;
  timezone?: string;
  locale?: string;
  privacyConsentAccepted?: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UpsertProfileRequest {
  firstName?: string;
  lastName?: string;
  gender?: string;
  pregnancyStatus?: PregnancyStatus;
  dateOfBirth: string;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  privacyConsentAccepted?: boolean;
}

export interface UpsertGoalRequest {
  goalType: GoalType;
  targetWeightKg?: number;
  targetTimelineDays?: number;
  impactMode?: GoalImpactMode;
}

export interface UpsertNutritionPreferencesRequest {
  dietType: DietType;
  mealsPerDay: number;
  notes?: string;
  allergies?: string[];
  excludedFoods?: string[];
  preferredFoods?: string[];
}

export interface TrainingScheduleItemRequest {
  dayOfWeek: number;
  localTime: string;
  sportType: SportType;
  durationMinutes: number;
  intensity: IntensityLevel;
  description?: string;
}

export interface GenerateDailyPlanRequest {
  forceRegenerate?: boolean;
}

export type DailyPlanStatus = 'READY' | 'FALLBACK';
export type DailyReadinessLevel = 'PUSH' | 'MAINTAIN' | 'RECOVER';
export type DailyPlanTrainingIntensity = 'REST' | 'LIGHT' | 'MODERATE' | 'HARD';

export interface DailyPlanFoodItem {
  name: string;
  portion: string;
  notes?: string;
}

export interface DailyPlanMeal {
  name: string;
  purpose: string;
  foods: DailyPlanFoodItem[];
}

export interface DailyPlanMenuOption {
  label: string;
  focus: string;
  meals: DailyPlanMeal[];
}

export interface DailyPlanJson {
  schemaVersion: 'sprint-2.v1';
  generatedAt: string;
  mockVersion: number;
  safety: {
    safeMode: boolean;
    adjustedForSafety: boolean;
    reasons: string[];
  };
  summary: {
    title: string;
    message: string;
    readiness: DailyReadinessLevel;
  };
  nutrition: {
    calorieGuidance: {
      label: string;
      notes: string;
    };
    macroGuidance: {
      protein: string;
      carbs: string;
      fat: string;
      notes: string;
    };
    meals: DailyPlanMeal[];
    menuOptions?: DailyPlanMenuOption[];
    hydration: {
      guidance: string;
      notes?: string;
    };
  };
  training: {
    recommendation: string;
    intensity: DailyPlanTrainingIntensity;
    notes: string;
  };
  recovery: {
    recommendation: string;
    sleepTip?: string;
    mobilityTip?: string;
  };
  reminders: string[];
  debug?: {
    provider: 'mock' | 'openai' | 'fallback';
    generatedBy:
      | 'MockAiProviderService'
      | 'OpenAiProviderService'
      | 'SafeFallbackPlanFactory';
    planQualityMode?: 'BASIC' | 'PERSONALIZED' | 'ADAPTIVE';
    fallbackReason?: string;
    safetyAgent?: {
      enabled: boolean;
      provider: 'mock' | 'openai';
      approved?: boolean;
      riskLevel?: 'low' | 'medium' | 'high';
      retryUsed?: boolean;
      retryResult?: 'approved' | 'rejected' | 'failed' | 'not_used';
    };
  };
}

export interface DailyPlanResponse {
  id: string;
  planLocalDate: string;
  planTimezone: string;
  status: DailyPlanStatus;
  readinessLevel: DailyReadinessLevel;
  updatedAt: string;
  plan: DailyPlanJson;
}

export type PlanFeedbackRating = 'HELPFUL' | 'NOT_HELPFUL';
export type PlanFeedbackTag =
  | 'TOO_MUCH_FOOD'
  | 'TOO_LITTLE_FOOD'
  | 'TRAINING_TOO_HARD'
  | 'TRAINING_TOO_EASY'
  | 'FELT_GOOD'
  | 'LOW_ENERGY'
  | 'RECOVERY_NEEDED';

export interface DailyPlanHistoryResponse {
  items: DailyPlanResponse[];
}

export interface SubmitDailyPlanFeedbackRequest {
  rating?: PlanFeedbackRating;
  tags?: PlanFeedbackTag[];
  notes?: string;
}

export interface DailyPlanFeedbackResponse {
  id: string;
  dailyPlanId: string;
  rating: PlanFeedbackRating | null;
  tags: PlanFeedbackTag[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
