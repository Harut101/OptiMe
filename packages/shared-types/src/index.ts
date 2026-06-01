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
