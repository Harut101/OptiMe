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
  PregnancyStatus,
  SubmitDailyPlanFeedbackRequest,
  SportType
} from '@optime/shared-types';

export type {
  DailyPlanFeedbackResponse,
  DailyPlanResponse,
  PlanFeedbackRating,
  PlanFeedbackTag,
  PregnancyStatus,
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
  stage1Completed?: boolean;
  canGenerateFirstPlan?: boolean;
  missingStage1Fields?: string[];
  progressiveProfile?: {
    completedPrompts: string[];
    nextPrompt?: {
      key: string;
      title: string;
      description: string;
      inputType: string;
      options?: Array<{ label: string; value: string }>;
    };
    completionPercent: number;
  };
}

export interface ProfileRequest {
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

export interface GoalRequest {
  goalType: GoalType;
  targetWeightKg?: number;
  targetTimelineDays?: number;
  impactMode?: GoalImpactMode;
}

export interface NutritionPreferencesRequest {
  dietType?: DietType;
  mealsPerDay?: number;
  noKnownAllergiesConfirmed?: boolean;
  notes?: string;
  allergies?: string[];
  excludedFoods?: string[];
  preferredFoods?: string[];
}

export interface TrainingIntentRequest {
  noTrainingPlanned: boolean;
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

export type SubscriptionPlan = 'FREE' | 'PLUS' | 'PRO';
export type PlanQualityMode = 'BASIC' | 'PERSONALIZED' | 'ADAPTIVE';
export type UsagePeriodType = 'DAILY' | 'MONTHLY';
export type UsageFeature =
  | 'DAILY_PLAN_GENERATION'
  | 'DAILY_PLAN_REFRESH'
  | 'AI_DAILY_PLAN_GENERATION'
  | 'AI_SAFETY_AGENT_REVIEW'
  | 'FUTURE_AI_COACH_MESSAGE';

export interface EntitlementSummary {
  currentPlan: SubscriptionPlan;
  planQualityMode: PlanQualityMode;
  isPremium: boolean;
  activeSubscriptionId?: string;
  source: 'subscription' | 'default_free';
  features: {
    canGenerateDailyPlan: boolean;
    canRefreshPlan: boolean;
    canUseOpenAIProvider: boolean;
    canUseAdvancedPersonalization: boolean;
    canUseFeedbackPersonalization: boolean;
    canViewHistory: boolean;
    canSubmitFeedback: boolean;
    canUseWeeklyReports: boolean;
    canUseWhoop: boolean;
    canUseAiCoach: boolean;
  };
}

export interface UsageSummaryItem {
  feature: UsageFeature;
  periodType: UsagePeriodType;
  count: number;
  limit: number;
  remaining: number;
  resetAt: string;
}

export interface UsageSummary {
  items: UsageSummaryItem[];
}

export interface UsageLimitExceededError {
  code: 'USAGE_LIMIT_REACHED';
  feature: UsageFeature;
  currentPlan: SubscriptionPlan;
  limit: number;
  periodType: UsagePeriodType;
  resetAt: string;
  upgradeSuggestion: 'PLUS' | 'PRO' | null;
}
