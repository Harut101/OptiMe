import type { TFunction } from 'i18next';
import type {
  ActivityLevel,
  DietType,
  ExerciseCategory,
  ExerciseEquipment,
  GoalImpactMode,
  GoalType,
  IntensityLevel,
  MovementPattern,
  PregnancyStatus,
  SportType,
  TargetMuscleGroup,
  TrainingEquipment,
  TrainingLevel,
  TrainingOutcome
} from '@optime/shared-types';
import type { HealthProvider, PlanQualityMode, SubscriptionPlan } from '@/types/api';

export type GenderValue = 'female' | 'male' | 'other' | 'prefer_not_to_say';

const maps = {
  goalType: map<GoalType>('goalType', ['HEALTHY_LIFESTYLE', 'IMPROVE_FITNESS', 'BUILD_MUSCLE', 'IMPROVE_ENDURANCE', 'REDUCE_WEIGHT']),
  goalImpact: map<GoalImpactMode>('goalImpact', ['NUTRITION_ONLY', 'NUTRITION_AND_TRAINING']),
  gender: map<GenderValue>('gender', ['female', 'male', 'other', 'prefer_not_to_say']),
  pregnancyStatus: map<PregnancyStatus>('pregnancyStatus', ['NOT_PREGNANT', 'PREGNANT', 'POSTPARTUM', 'BREASTFEEDING', 'PREFER_NOT_TO_SAY', 'UNKNOWN']),
  activityLevel: map<ActivityLevel>('activityLevel', ['LOW', 'LIGHT', 'MODERATE', 'HIGH', 'ATHLETE']),
  dietType: map<DietType>('dietType', ['NONE', 'OMNIVORE', 'VEGETARIAN', 'VEGAN', 'PESCATARIAN', 'KETO', 'LOW_CARB', 'MEDITERRANEAN', 'HALAL', 'KOSHER']),
  trainingOutcome: map<TrainingOutcome>('trainingOutcome', ['STRENGTH', 'MUSCLE_GROWTH', 'ENDURANCE', 'MOBILITY', 'GENERAL_FITNESS']),
  trainingLevel: map<TrainingLevel>('trainingLevel', ['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  equipment: map<TrainingEquipment>('equipment', ['GYM', 'HOME', 'DUMBBELLS', 'BODYWEIGHT', 'MACHINES']),
  muscleGroup: map<TargetMuscleGroup>('muscleGroup', ['CHEST', 'TRAPS', 'LATS', 'LOWER_BACK', 'ABS', 'OBLIQUES', 'BICEPS', 'TRICEPS', 'FOREARMS', 'QUADRICEPS', 'HAMSTRINGS', 'ADDUCTORS', 'ABDUCTORS', 'CALVES', 'BACK', 'LEGS', 'GLUTES', 'CORE', 'SHOULDERS', 'ARMS', 'FULL_BODY']),
  sportType: map<SportType>('sportType', ['RUNNING', 'CYCLING', 'GYM', 'STRENGTH', 'HIIT', 'YOGA', 'SWIMMING', 'WALKING', 'TEAM_SPORT', 'OTHER']),
  intensity: map<IntensityLevel>('intensity', ['LOW', 'MODERATE', 'HIGH']),
  measurementSystem: map<'METRIC' | 'IMPERIAL'>('measurementSystem', ['METRIC', 'IMPERIAL']),
  healthProvider: map<HealthProvider>('healthProvider', ['APPLE_HEALTH', 'HEALTH_CONNECT']),
  subscriptionPlan: map<SubscriptionPlan>('subscriptionPlan', ['FREE', 'PLUS', 'PRO']),
  planQualityMode: map<PlanQualityMode>('planQualityMode', ['BASIC', 'PERSONALIZED', 'ADAPTIVE']),
  exerciseEquipment: map<ExerciseEquipment>('exerciseEquipment', ['NONE', 'BODYWEIGHT', 'DUMBBELLS', 'BARBELL', 'KETTLEBELL', 'RESISTANCE_BANDS', 'MACHINES', 'BENCH', 'PULL_UP_BAR', 'CABLE_MACHINE', 'CARDIO_MACHINE']),
  exerciseCategory: map<ExerciseCategory>('exerciseCategory', ['STRENGTH', 'MOBILITY', 'CARDIO', 'RECOVERY']),
  movementPattern: map<MovementPattern>('movementPattern', ['SQUAT', 'HINGE', 'HORIZONTAL_PUSH', 'VERTICAL_PUSH', 'HORIZONTAL_PULL', 'VERTICAL_PULL', 'LUNGE', 'CARRY', 'ROTATION', 'ANTI_ROTATION', 'CORE_FLEXION', 'CORE_STABILITY', 'ISOLATION', 'MOBILITY', 'CARDIO', 'RECOVERY'])
} as const;

function map<T extends string>(group: string, values: readonly T[]) {
  return Object.fromEntries(values.map((value) => [value, `enums.${group}.${value}`])) as Record<T, string>;
}

function label<T extends string>(t: TFunction, values: Record<T, string>, value: T) {
  const key = values[value];
  return key ? t(key as never) : value;
}

export const getGoalTypeLabel = (t: TFunction, value: GoalType) => label(t, maps.goalType, value);
export const getGoalImpactLabel = (t: TFunction, value: GoalImpactMode) => label(t, maps.goalImpact, value);
export const getGenderLabel = (t: TFunction, value: GenderValue) => label(t, maps.gender, value);
export const getPregnancyStatusLabel = (t: TFunction, value: PregnancyStatus) => label(t, maps.pregnancyStatus, value);
export const getActivityLevelLabel = (t: TFunction, value: ActivityLevel) => label(t, maps.activityLevel, value);
export const getDietTypeLabel = (t: TFunction, value: DietType) => label(t, maps.dietType, value);
export const getTrainingOutcomeLabel = (t: TFunction, value: TrainingOutcome) => label(t, maps.trainingOutcome, value);
export const getTrainingLevelLabel = (t: TFunction, value: TrainingLevel) => label(t, maps.trainingLevel, value);
export const getEquipmentLabel = (t: TFunction, value: TrainingEquipment) => label(t, maps.equipment, value);
export const getMuscleGroupLabel = (t: TFunction, value: TargetMuscleGroup) => label(t, maps.muscleGroup, value);
export const getSportTypeLabel = (t: TFunction, value: SportType) => label(t, maps.sportType, value);
export const getIntensityLabel = (t: TFunction, value: IntensityLevel) => label(t, maps.intensity, value);
export const getMeasurementSystemLabel = (t: TFunction, value: 'METRIC' | 'IMPERIAL') => label(t, maps.measurementSystem, value);
export const getHealthProviderLabel = (t: TFunction, value: HealthProvider) => label(t, maps.healthProvider, value);
export const getSubscriptionPlanLabel = (t: TFunction, value: SubscriptionPlan) => label(t, maps.subscriptionPlan, value);
export const getPlanQualityModeLabel = (t: TFunction, value: PlanQualityMode) => label(t, maps.planQualityMode, value);
export const getExerciseEquipmentLabel = (t: TFunction, value: ExerciseEquipment) => label(t, maps.exerciseEquipment, value);
export const getExerciseCategoryLabel = (t: TFunction, value: ExerciseCategory) => label(t, maps.exerciseCategory, value);
export const getMovementPatternLabel = (t: TFunction, value: MovementPattern) => label(t, maps.movementPattern, value);

export function enumOptions<T extends string>(values: readonly T[], getLabel: (value: T) => string) {
  return values.map((value) => ({ value, label: getLabel(value) }));
}

export const ENUM_TRANSLATION_MAPS = maps;
