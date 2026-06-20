export type SprintOnePlan = 'FREE';

export const SUPPORTED_LOCALES = ['en-US', 'ru-RU', 'fr-FR', 'zh-CN'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'en-US';

export const MEASUREMENT_SYSTEMS = ['METRIC', 'IMPERIAL'] as const;
export type MeasurementSystem = (typeof MEASUREMENT_SYSTEMS)[number];

export function isSupportedLocale(value: string): value is SupportedLocale {
  return SUPPORTED_LOCALES.includes(value as SupportedLocale);
}

export function resolveSupportedLocale(value?: string | null): SupportedLocale {
  if (!value) return DEFAULT_LOCALE;
  if (isSupportedLocale(value)) return value;

  const normalized = value.replace('_', '-').toLowerCase();
  if (normalized.startsWith('en-') || normalized === 'en') return 'en-US';
  if (normalized.startsWith('ru-') || normalized === 'ru') return 'ru-RU';
  if (normalized.startsWith('fr-') || normalized === 'fr') return 'fr-FR';
  if (
    normalized === 'zh-cn' ||
    normalized === 'zh-sg' ||
    normalized === 'zh-hans' ||
    normalized.startsWith('zh-hans-')
  ) return 'zh-CN';

  return DEFAULT_LOCALE;
}

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
export type TrainingOutcome =
  | 'STRENGTH'
  | 'MUSCLE_GROWTH'
  | 'ENDURANCE'
  | 'MOBILITY'
  | 'GENERAL_FITNESS';
export const TRAINING_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;
export type TrainingLevel = (typeof TRAINING_LEVELS)[number];
export const TARGET_MUSCLE_GROUPS = ['CHEST', 'TRAPS', 'LATS', 'LOWER_BACK', 'ABS', 'OBLIQUES', 'BICEPS', 'TRICEPS', 'FOREARMS', 'QUADRICEPS', 'HAMSTRINGS', 'ADDUCTORS', 'ABDUCTORS', 'CALVES', 'BACK', 'LEGS', 'GLUTES', 'CORE', 'SHOULDERS', 'ARMS', 'FULL_BODY'] as const;
export type TargetMuscleGroup = (typeof TARGET_MUSCLE_GROUPS)[number];
export type TrainingEquipment = 'GYM' | 'HOME' | 'DUMBBELLS' | 'BODYWEIGHT' | 'MACHINES';

export const EXERCISE_CATEGORIES = ['STRENGTH', 'MOBILITY', 'CARDIO', 'RECOVERY'] as const;
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];
export const EXERCISE_EQUIPMENT = ['NONE', 'BODYWEIGHT', 'DUMBBELLS', 'BARBELL', 'KETTLEBELL', 'RESISTANCE_BANDS', 'MACHINES', 'BENCH', 'PULL_UP_BAR', 'CABLE_MACHINE', 'CARDIO_MACHINE'] as const;
export type ExerciseEquipment = (typeof EXERCISE_EQUIPMENT)[number];
export const MOVEMENT_PATTERNS = ['SQUAT', 'HINGE', 'HORIZONTAL_PUSH', 'VERTICAL_PUSH', 'HORIZONTAL_PULL', 'VERTICAL_PULL', 'LUNGE', 'CARRY', 'ROTATION', 'ANTI_ROTATION', 'CORE_FLEXION', 'CORE_STABILITY', 'ISOLATION', 'MOBILITY', 'CARDIO', 'RECOVERY'] as const;
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];
export const EXERCISE_CONTRAINDICATION_TAGS = ['WRIST_LOAD', 'ELBOW_LOAD', 'SHOULDER_LOAD', 'KNEE_LOAD', 'LOWER_BACK_LOAD', 'OVERHEAD_POSITION', 'BALANCE_REQUIRED', 'HIGH_IMPACT', 'PRONE_POSITION', 'SUPINE_POSITION', 'PREGNANCY_REVIEW', 'POSTPARTUM_REVIEW'] as const;
export type ExerciseContraindicationTag = (typeof EXERCISE_CONTRAINDICATION_TAGS)[number];
export const EXERCISE_MEDIA_TYPES = ['PRIMARY', 'TECHNIQUE', 'ANATOMY', 'ALTERNATE'] as const;
export type ExerciseMediaType = (typeof EXERCISE_MEDIA_TYPES)[number];
export type ExerciseTrainingLevel = TrainingLevel;

export interface ExerciseThumbnail {
  url: string;
  altText: string;
}

export interface ExerciseListItem {
  id: string;
  slug: string;
  name: string;
  category: ExerciseCategory;
  targetMuscles: TargetMuscleGroup[];
  equipment: ExerciseEquipment[];
  thumbnail: ExerciseThumbnail | null;
  resolvedLocale: SupportedLocale;
}

export interface ExerciseMediaItem {
  id: string;
  type: ExerciseMediaType;
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  sortOrder: number;
  isPrimary: boolean;
  altText: string;
  caption: string | null;
}

export interface ExerciseDetail {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: ExerciseCategory;
  movementPattern: MovementPattern;
  equipment: ExerciseEquipment[];
  targetMuscles: TargetMuscleGroup[];
  secondaryMuscles: TargetMuscleGroup[];
  trainingLevels: ExerciseTrainingLevel[];
  instructions: string[];
  coachingCues: string[];
  safetyNotes: string[];
  contraindicationTags: ExerciseContraindicationTag[];
  media: ExerciseMediaItem[];
  resolvedLocale: SupportedLocale;
}

export interface ExerciseListFilters {
  category?: ExerciseCategory;
  equipment?: ExerciseEquipment;
  targetMuscle?: TargetMuscleGroup;
  trainingLevel?: ExerciseTrainingLevel;
  movementPattern?: MovementPattern;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ExerciseListResponse {
  items: ExerciseListItem[];
  pagination: PaginationMeta;
}

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
  dietType?: DietType;
  mealsPerDay?: number;
  noKnownAllergiesConfirmed?: boolean;
  notes?: string;
  allergies?: string[];
  excludedFoods?: string[];
  preferredFoods?: string[];
}

export interface UpdateTrainingIntentRequest {
  noTrainingPlanned: boolean;
}

export interface TrainingScheduleItemRequest {
  dayOfWeek: number;
  localTime: string;
  sportType: SportType;
  durationMinutes: number;
  intensity: IntensityLevel;
  description?: string;
}

export interface UpsertTrainingPreferenceRequest {
  targetMuscleGroups?: TargetMuscleGroup[];
  trainingOutcome?: TrainingOutcome | null;
  equipment?: TrainingEquipment[];
  trainingLevel?: TrainingLevel | null;
  limitationsOrPainAreas?: string[];
  preferredTrainingDays?: number[];
}

export interface TrainingPreferenceResponse {
  targetMuscleGroups: TargetMuscleGroup[];
  trainingOutcome: TrainingOutcome | null;
  equipment: TrainingEquipment[];
  trainingLevel: TrainingLevel | null;
  limitationsOrPainAreas: string[];
  preferredTrainingDays: number[];
}

export interface OnboardingProgressivePrompt {
  key: string;
  title: string;
  description: string;
  inputType: string;
  options?: Array<{ label: string; value: string }>;
}

export interface OnboardingStatusResponse {
  profileCompleted: boolean;
  goalCompleted: boolean;
  nutritionPreferencesCompleted: boolean;
  trainingScheduleCompleted: boolean;
  privacyConsentCompleted: boolean;
  canGeneratePlan: boolean;
  stage1Completed: boolean;
  canGenerateFirstPlan: boolean;
  missingStage1Fields: string[];
  progressiveProfile: {
    completedPrompts: string[];
    nextPrompt?: OnboardingProgressivePrompt;
    completionPercent: number;
  };
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

export interface DailyPlanExercise {
  name: string;
  targetMuscles: string[];
  equipment: string[];
  sets?: string;
  reps?: string;
  rest?: string;
  duration?: string;
  intensityCue?: string;
  safetyNotes?: string;
}

export interface DailyPlanJson {
  schemaVersion: 'sprint-2.v1';
  generatedAt: string;
  mockVersion: number;
  safety: {
    safeMode: boolean;
    adjustedForSafety: boolean;
    reasons: string[];
    userSafeMessage?: string;
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
    exercises?: DailyPlanExercise[];
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
    protocols?: {
      nutritionProtocolId: string;
      trainingProtocolId: string;
      recoveryProtocolId: string;
    };
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
