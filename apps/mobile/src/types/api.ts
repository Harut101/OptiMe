import type {
  ActivityLevel,
  DailyFoodPlan,
  DailyPlanExercise,
  DailyPlanResponse,
  DailyPlanFeedbackResponse,
  DietType,
  ExerciseDetail,
  ExerciseListItem,
  ExerciseListResponse,
  FoodMeal,
  GoalImpactMode,
  GoalType,
  IntensityLevel,
  NutritionTarget,
  NutritionTargetSnapshot,
  PlanFeedbackRating,
  PlanFeedbackTag,
  PregnancyStatus,
  PrimaryGoal,
  SubmitDailyPlanFeedbackRequest,
  SportType,
  TargetMuscleGroup,
  TrainingEnvironment,
  ExerciseEquipment,
  DayOfWeek,
  TrainingScheduleOverrideMode,
  TrainingScheduleResponse,
  TrainingScheduleRequest,
  TrainingEquipment,
  TrainingLevel,
  TrainingOutcome
} from '@optime/shared-types';
import type { MeasurementSystem, SupportedLocale } from '@optime/shared-types';

export type {
  DailyPlanExercise,
  DailyFoodPlan,
  DailyPlanFeedbackResponse,
  DailyPlanResponse,
  ExerciseDetail,
  ExerciseListItem,
  ExerciseListResponse,
  FoodMeal,
  NutritionTarget,
  NutritionTargetSnapshot,
  PlanFeedbackRating,
  PlanFeedbackTag,
  PregnancyStatus,
  SubmitDailyPlanFeedbackRequest,
  TargetMuscleGroup,
  TrainingEnvironment,
  ExerciseEquipment,
  DayOfWeek,
  TrainingScheduleOverrideMode,
  TrainingScheduleResponse,
  TrainingScheduleRequest,
  TrainingEquipment,
  TrainingLevel,
  TrainingOutcome,
  TrainingPreferenceResponse
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

export interface UserSettingsResponse {
  preferredLocale: SupportedLocale;
  measurementSystem: MeasurementSystem;
  initialized: boolean;
}

export interface UpdateUserSettingsRequest {
  preferredLocale?: SupportedLocale;
  measurementSystem?: MeasurementSystem;
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

export interface ProfileResponse {
  user: UserDto;
  profile: null | {
    gender: string | null;
    pregnancyStatus: PregnancyStatus;
    dateOfBirth: string;
    heightCm: number;
    weightKg: number;
    activityLevel: ActivityLevel;
  };
}

export interface GoalRequest {
  goalType?: GoalType;
  primaryGoal?: PrimaryGoal;
  targetWeightKg?: number;
  targetTimelineDays?: number;
  impactMode?: GoalImpactMode;
  appMode?: GoalImpactMode;
}

export interface GoalResponse {
  id: string;
  goalType: GoalType;
  primaryGoal?: PrimaryGoal | null;
  targetWeightKg?: number | null;
  targetTimelineDays?: number | null;
  impactMode?: GoalImpactMode | null;
  appMode?: GoalImpactMode | null;
}

export interface NutritionPreferencesRequest {
  dietType?: DietType;
  mealsPerDay?: number;
  noKnownAllergiesConfirmed?: boolean;
  notes?: string;
  allergies?: string[];
  excludedFoods?: string[];
  dislikedFoods?: string[];
  preferredFoods?: string[];
}

export interface NutritionPreferencesResponse {
  id: string;
  dietType: DietType;
  mealsPerDay: number;
  noKnownAllergiesConfirmed: boolean;
  notes: string | null;
  allergies: Array<{ id: string; name: string }>;
  excludedFoods: Array<{ id: string; name: string }>;
  dislikedFoods: Array<{ id: string; name: string }>;
  preferredFoods: Array<{ id: string; name: string }>;
}

export interface TrainingPreferencesRequest {
  targetMuscleGroups?: TargetMuscleGroup[];
  trainingOutcome?: TrainingOutcome | null;
  equipment?: TrainingEquipment[];
  trainingLevel?: TrainingLevel | null;
  limitationsOrPainAreas?: string[];
  preferredTrainingDays?: number[];
}

export interface TrainingIntentRequest {
  noTrainingPlanned: boolean;
}

export type ProgressivePromptInputType = 'stringList' | 'singleSelect' | 'multiSelect' | 'number';

export interface ProgressivePrompt {
  key: string;
  title: string;
  description: string;
  inputType: ProgressivePromptInputType;
  options?: Array<{ label: string; value: string }>;
}

export interface ProgressiveProfileSummary {
  completedPrompts: string[];
  nextPrompt?: ProgressivePrompt;
  completionPercent: number;
}

export interface ProgressivePromptAnswerRequest {
  value: string | string[] | number | boolean;
}

export interface ProgressivePromptAnswerResponse {
  answered: true;
  promptKey: string;
  progressiveProfile: ProgressiveProfileSummary;
}

export interface ProgressivePromptSkipResponse {
  skipped: true;
  promptKey: string;
  skippedUntil: string;
  progressiveProfile: ProgressiveProfileSummary;
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

export type DailyCheckInType = 'MEAL' | 'TRAINING' | 'EVENING_REFLECTION';
export type MealCheckInStatus = 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'SKIPPED' | 'SWAPPED';
export type TrainingCheckInStatus =
  | 'COMPLETED'
  | 'PARTIALLY_COMPLETED'
  | 'SKIPPED'
  | 'RESTED_INSTEAD';

export interface MealCheckInPayload {
  mealIndex?: number;
  mealName?: string;
  status: MealCheckInStatus;
  notes?: string;
}

export interface TrainingCheckInPayload {
  status: TrainingCheckInStatus;
  perceivedDifficulty?: number;
  energyAfter?: number;
  painOrDiscomfort?: boolean;
  notes?: string;
}

export interface EveningReflectionCheckInPayload {
  energyLevel?: number;
  tirednessLevel?: number;
  sorenessLevel?: number;
  mood?: string;
  notes?: string;
}

export type DailyPlanCheckInPayload =
  | MealCheckInPayload
  | TrainingCheckInPayload
  | EveningReflectionCheckInPayload;

export interface CreateDailyPlanCheckInRequest {
  type: DailyCheckInType;
  payload: DailyPlanCheckInPayload;
}

export interface DailyPlanCheckInResponse {
  id: string;
  dailyPlanId: string;
  type: DailyCheckInType;
  subjectKey: string;
  payload: DailyPlanCheckInPayload;
  createdAt: string;
  updatedAt: string;
}

export interface DailyPlanCheckInsResponse {
  items: DailyPlanCheckInResponse[];
}

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

export type HealthProvider = 'APPLE_HEALTH' | 'HEALTH_CONNECT';
export type HealthConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'PERMISSION_DENIED' | 'ERROR';

export interface HealthPermissions {
  steps?: boolean;
  sleep?: boolean;
  workouts?: boolean;
  activeEnergy?: boolean;
  weight?: boolean;
  heartRate?: boolean;
  restingHeartRate?: boolean;
}

export interface HealthConnection {
  provider: HealthProvider;
  status: HealthConnectionStatus;
  consentedAt: string | null;
  disconnectedAt: string | null;
  lastSyncAt: string | null;
  permissionsGranted: HealthPermissions | null;
  errorReason: string | null;
}

export interface HealthStatusResponse {
  connections: HealthConnection[];
}

export interface ConnectHealthRequest {
  provider: HealthProvider;
  permissionsGranted?: HealthPermissions;
}

export interface DisconnectHealthRequest {
  provider: HealthProvider;
}

export interface DeleteHealthDataRequest {
  provider?: HealthProvider;
}

export interface DeleteHealthDataResponse {
  deleted: true;
  provider: HealthProvider | null;
  summaryCountDeleted: number;
}

export interface HealthDailySummaryRequest {
  localDate: string;
  timezone: string;
  sourceProvider: HealthProvider;
  steps?: number;
  sleepMinutes?: number;
  activeEnergyKcal?: number;
  workoutCount?: number;
  workoutMinutes?: number;
  averageHeartRate?: number;
  restingHeartRate?: number;
  weightKg?: number;
}

export interface HealthDailySummary {
  localDate: string;
  timezone: string;
  sourceProvider: HealthProvider;
  steps: number | null;
  sleepMinutes: number | null;
  activeEnergyKcal: number | null;
  workoutCount: number | null;
  workoutMinutes: number | null;
  averageHeartRate: number | null;
  restingHeartRate: number | null;
  weightKg: number | null;
  updatedAt: string;
}

export interface UpsertHealthDailySummaryResponse {
  summary: HealthDailySummary;
}
