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
export type AppMode = GoalImpactMode;
export type PrimaryGoal =
  | 'WEIGHT_LOSS'
  | 'WEIGHT_MAINTENANCE'
  | 'WEIGHT_GAIN'
  | 'HEALTHY_EATING';
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
export const TRAINING_ENVIRONMENTS = ['HOME', 'GYM', 'OUTDOOR'] as const;
export type TrainingEnvironment = (typeof TRAINING_ENVIRONMENTS)[number];
export const DAYS_OF_WEEK = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];
export type TrainingScheduleOverrideMode = 'USE_DEFAULT' | 'CUSTOM';
export type TrainingScheduleInheritedField =
  | 'TARGET_MUSCLES'
  | 'ENVIRONMENT'
  | 'EQUIPMENT'
  | 'DURATION'
  | 'PROTOCOL';

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
  ids?: string[];
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
  goalType?: GoalType;
  primaryGoal?: PrimaryGoal;
  targetWeightKg?: number;
  targetTimelineDays?: number;
  impactMode?: GoalImpactMode;
  appMode?: AppMode;
}

export interface UpsertNutritionPreferencesRequest {
  dietType?: DietType;
  mealsPerDay?: number;
  noKnownAllergiesConfirmed?: boolean;
  notes?: string;
  allergies?: string[];
  excludedFoods?: string[];
  dislikedFoods?: string[];
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

export interface ResolvedTrainingDayContext {
  source: 'WEEKLY_SCHEDULE' | 'GLOBAL_DEFAULTS';
  localDate: string;
  dayOfWeek: DayOfWeek;
  isTrainingDay: boolean;
  targetMuscles: TargetMuscleGroup[];
  environment: TrainingEnvironment | null;
  availableEquipment: ExerciseEquipment[];
  durationMinutes: number;
  protocolPreference: string | null;
  inheritedFields: TrainingScheduleInheritedField[];
}

export interface TrainingScheduleDayRequest {
  dayOfWeek: DayOfWeek;
  isTrainingDay: boolean;
  targetMusclesMode: TrainingScheduleOverrideMode;
  targetMuscles?: TargetMuscleGroup[];
  environmentMode: TrainingScheduleOverrideMode;
  environment?: TrainingEnvironment | null;
  equipmentMode: TrainingScheduleOverrideMode;
  availableEquipment?: ExerciseEquipment[];
  durationMode: TrainingScheduleOverrideMode;
  durationMinutes?: number | null;
  protocolMode?: TrainingScheduleOverrideMode;
  protocolPreference?: string | null;
}

export interface TrainingScheduleRequest {
  isActive: boolean;
  days: TrainingScheduleDayRequest[];
}

export interface TrainingScheduleDayResponse extends TrainingScheduleDayRequest {
  id: string;
  resolved: ResolvedTrainingDayContext;
}

export interface TrainingScheduleResponse {
  id: string | null;
  isActive: boolean;
  weekStartsOn: 'MONDAY';
  derivedWeeklyFrequency: number;
  days: TrainingScheduleDayResponse[];
  defaults: {
    targetMuscles: TargetMuscleGroup[];
    environment: TrainingEnvironment | null;
    availableEquipment: ExerciseEquipment[];
    durationMinutes: number;
    protocolPreference: string | null;
  };
}

export type NutritionDayType =
  | 'NUTRITION_ONLY'
  | 'TRAINING_DAY'
  | 'REST_DAY'
  | 'TRAINING_DISABLED';

export type NutritionSafetyStatus = 'OK' | 'LIMITED' | 'NEEDS_MORE_INFO';

export type NutritionTargetSource = 'DETERMINISTIC_ENGINE';

export type NutritionTargetTitleCode =
  | 'TODAY_TARGET'
  | 'MORE_INFO_NEEDED';

export type NutritionTargetReasonCode =
  | 'BASED_ON_PRIMARY_GOAL'
  | 'BASED_ON_NORMAL_ACTIVITY'
  | 'NUTRITION_ONLY_MODE'
  | 'ADJUSTED_FOR_TRAINING_DAY'
  | 'SCHEDULED_REST_DAY'
  | 'TRAINING_DISABLED'
  | 'CONSERVATIVE_SAFETY_TARGET'
  | 'NEEDS_PROFILE_DETAILS'
  | 'LIMITED_BY_HEALTH_CONTEXT'
  | 'MACROS_DERIVED_FROM_TARGET'
  | 'USING_MAINTENANCE_ESTIMATE'
  | 'WEIGHT_LOSS_DEFICIT_APPLIED'
  | 'WEIGHT_GAIN_SURPLUS_APPLIED'
  | 'HEALTHY_EATING_BALANCED_TARGET';

export type NutritionTargetMissingField =
  | 'profile'
  | 'dateOfBirth'
  | 'heightCm'
  | 'weightKg'
  | 'activityLevel';

export interface NutritionTargetReason {
  code: NutritionTargetReasonCode;
  params?: {
    primaryGoal?: PrimaryGoal;
    appMode?: AppMode;
    dayType?: NutritionDayType;
    durationMinutes?: number;
    targetKcal?: number;
    minKcal?: number;
    maxKcal?: number;
    proteinGrams?: number;
    carbsGrams?: number;
    fatGrams?: number;
    missingFields?: NutritionTargetMissingField[];
  };
}

export interface NutritionCalorieTarget {
  targetKcal: number;
  minKcal: number;
  maxKcal: number;
  maintenanceEstimateKcal: number;
  adjustmentKcal: number;
  adjustmentReason: string;
}

export interface NutritionMacroTarget {
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  proteinKcal: number;
  carbsKcal: number;
  fatKcal: number;
}

export interface NutritionTargetContext {
  trainingEnabled: boolean;
  scheduledTrainingDay: boolean;
  plannedWorkoutDurationMinutes: number | null;
  plannedWorkoutIntensity: string | null;
  normalActivityLevel: ActivityLevel | null;
  inheritedScheduleFields?: TrainingScheduleInheritedField[];
}

export interface NutritionTargetSafety {
  status: NutritionSafetyStatus;
  reasons: string[];
  warnings: string[];
}

export interface NutritionTargetExplanation {
  titleCode: NutritionTargetTitleCode;
  reasonCodes: NutritionTargetReason[];
}

export interface LegacyNutritionTargetExplanation {
  title: string;
  bullets: string[];
}

export interface NutritionTarget {
  engineVersion: number;
  localDate: string;
  source: NutritionTargetSource;
  appMode: AppMode;
  primaryGoal: PrimaryGoal;
  dayType: NutritionDayType;
  calories: NutritionCalorieTarget;
  macros: NutritionMacroTarget;
  context: NutritionTargetContext;
  safety: NutritionTargetSafety;
  explanation: NutritionTargetExplanation;
}

export interface NutritionTargetInput {
  userId: string;
  planLocalDate?: string;
}

export interface NutritionTargetSnapshot {
  engineVersion: number;
  localDate: string;
  dayType: NutritionDayType;
  appMode: AppMode;
  primaryGoal: PrimaryGoal;
  targetKcal: number;
  minKcal: number;
  maxKcal: number;
  maintenanceEstimateKcal: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  safetyStatus: NutritionSafetyStatus;
  safetyReasons: string[];
  explanation: NutritionTargetExplanation | LegacyNutritionTargetExplanation;
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

export type DailyFoodPlanSource = 'NUTRITION_AGENT' | 'DETERMINISTIC_FALLBACK';
export type DailyFoodPlanValidationStatus = 'VALID' | 'ADJUSTED' | 'FALLBACK' | 'INVALID';
export type FoodMealType =
  | 'BREAKFAST'
  | 'LUNCH'
  | 'DINNER'
  | 'SNACK'
  | 'PRE_WORKOUT'
  | 'POST_WORKOUT';
export type FoodIngredientUnit = 'g' | 'ml' | 'piece' | 'tbsp' | 'tsp' | 'cup' | 'serving';
export type FoodMealReasonCode =
  | 'TARGET_ALIGNED'
  | 'PREFERENCE_ALIGNED'
  | 'TRAINING_SUPPORT'
  | 'RECOVERY_SUPPORT'
  | 'SIMPLE_PREP'
  | 'SAFETY_ADJUSTED'
  | 'BALANCED_ENERGY';
export type FoodSubstitutionReasonCode =
  | 'ALLERGY_SAFE_ALTERNATIVE'
  | 'EXCLUDED_FOOD_ALTERNATIVE'
  | 'PREFERENCE_SWAP'
  | 'SIMILAR_MACROS'
  | 'SIMPLER_PREP';

export interface FoodNutritionTotals {
  caloriesKcal: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
}

export interface FoodIngredient extends FoodNutritionTotals {
  name: string;
  quantity: number;
  unit: FoodIngredientUnit;
  isOptional: boolean;
}

export interface FoodSubstitution {
  originalItem: string;
  replacementItem: string;
  servingSummary: string;
  reasonCode: FoodSubstitutionReasonCode;
  macroImpactNote: string | null;
}

export interface FoodMeal extends FoodNutritionTotals {
  id: string;
  mealType: FoodMealType;
  title: string;
  shortDescription: string | null;
  prepTimeMinutes: number | null;
  servingSummary: string;
  ingredients: FoodIngredient[];
  preparationSteps: string[];
  substitutions: FoodSubstitution[];
  explanation: {
    reasonCodes: FoodMealReasonCode[];
    params?: Record<string, unknown>;
  };
}

export interface DailyFoodPlan {
  source: DailyFoodPlanSource;
  localDate: string;
  locale: SupportedLocale;
  nutritionTargetSnapshot: NutritionTargetSnapshot;
  totals: FoodNutritionTotals;
  validation: {
    status: DailyFoodPlanValidationStatus;
    reasons: string[];
    tolerances: {
      caloriesPercent: number;
      proteinGrams: number;
      carbsGrams: number;
      fatGrams: number;
    };
  };
  meals: FoodMeal[];
}

export interface DailyPlanExercise {
  exerciseId?: string;
  slug?: string;
  name: string;
  targetMuscles: string[];
  equipment: string[];
  sets?: string;
  reps?: string;
  rest?: string;
  duration?: string;
  intensityCue?: string;
  safetyNotes?: string;
  notes?: string;
  exerciseSnapshot?: DailyPlanExerciseSnapshot;
}

export interface DailyPlanExerciseSnapshot {
  resolvedLocale: SupportedLocale;
  category: ExerciseCategory;
  movementPattern: MovementPattern;
  equipment: ExerciseEquipment[];
  targetMuscles: TargetMuscleGroup[];
  secondaryMuscles: TargetMuscleGroup[];
  instructions: string[];
  coachingCues: string[];
  safetyNotes: string[];
  exerciseUpdatedAt: string;
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
    foodPlan?: DailyFoodPlan;
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
  trainingScheduleSnapshot?: ResolvedTrainingDayContext;
  nutritionTargetSnapshot?: NutritionTargetSnapshot;
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
    exerciseSelection?: {
      candidateCount: number;
      requestedExerciseCount: number;
      fallbackMode: 'NONE' | 'BODYWEIGHT_ONLY' | 'RECOVERY_FOCUSED' | 'MINIMAL_SAFE_POOL';
      usedAiRetry: boolean;
      usedDeterministicFallback: boolean;
      resolvedLocale: SupportedLocale;
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
