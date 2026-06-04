import type {
  ActivityLevel,
  DailyPlanResponse,
  DailyPlanFeedbackResponse,
  DietType,
  GoalImpactMode,
  GoalType,
  IntensityLevel,
  PlanFeedbackRating,
  PlanFeedbackTag,
  SubmitDailyPlanFeedbackRequest,
  SportType
} from '@optime/shared-types';

export type {
  DailyPlanFeedbackResponse,
  DailyPlanResponse,
  PlanFeedbackRating,
  PlanFeedbackTag,
  SubmitDailyPlanFeedbackRequest
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
