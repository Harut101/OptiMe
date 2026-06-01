import type {
  ActivityLevel,
  DietType,
  GoalImpactMode,
  GoalType,
  IntensityLevel,
  SportType
} from '@optime/shared-types';

export interface UserDto {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  timezone: string;
  locale: string;
  isMinor: boolean;
  safeMode: boolean;
  privacyConsentedAt: string | null;
}

export interface AuthResponse {
  accessToken: string;
  user: UserDto;
}

export interface OnboardingStatus {
  profileCompleted: boolean;
  goalCompleted: boolean;
  nutritionPreferencesCompleted: boolean;
  trainingScheduleCompleted: boolean;
  privacyConsentCompleted: boolean;
  canGeneratePlan: boolean;
}

export interface ProfileRequest {
  firstName?: string;
  lastName?: string;
  gender?: string;
  dateOfBirth: string;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  privacyConsentAccepted?: boolean;
}

export interface GoalRequest {
  goalType: GoalType;
  targetWeightKg?: number;
  targetTimelineDays?: number;
  impactMode?: GoalImpactMode;
}

export interface NutritionPreferencesRequest {
  dietType: DietType;
  mealsPerDay: number;
  notes?: string;
  allergies?: string[];
  excludedFoods?: string[];
  preferredFoods?: string[];
}

export interface TrainingScheduleItem {
  id: string;
  dayOfWeek: number;
  localTime: string;
  sportType: SportType;
  durationMinutes: number;
  intensity: IntensityLevel;
  description?: string | null;
}

export type TrainingScheduleItemRequest = Omit<TrainingScheduleItem, 'id'>;

export interface DailyPlanResponse {
  planId: string;
  status: 'READY' | 'FALLBACK';
  readinessLevel: 'RECOVER' | 'MAINTAIN' | 'PUSH';
  planLocalDate: string;
  planTimezone: string;
  plan: MockDailyPlanPayload;
  createdAt: string;
  updatedAt: string;
}

export interface MockDailyPlanPayload {
  status: 'READY' | 'FALLBACK';
  readinessLevel: 'RECOVER' | 'MAINTAIN' | 'PUSH';
  planLocalDate: string;
  planTimezone: string;
  plan: {
    summary: string;
    calorieGuidance: {
      targetCalories: number | null;
      reason: string;
    };
    macroGuidance: {
      proteinGrams: number | null;
      carbsGrams: number | null;
      fatsGrams: number | null;
    };
    meals: Array<{
      mealName: string;
      timing: string;
      foods: Array<{
        name: string;
        portion: string;
        notes: string;
      }>;
      approxCalories: number | null;
      notes: string;
    }>;
    hydration: {
      targetLiters: number;
      timingNotes: string;
    };
    trainingRecommendation: {
      mode: 'RECOVER' | 'MAINTAIN' | 'PUSH';
      summary: string;
      intensity: string;
      durationMinutes: number;
    };
    recoveryRecommendation: {
      summary: string;
      actions: string[];
    };
    coachExplanation: string;
    warnings: string[];
  };
}
