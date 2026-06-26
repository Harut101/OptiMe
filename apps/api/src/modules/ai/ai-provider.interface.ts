import {
  ActivityLevel,
  DietType,
  GoalImpactMode,
  GoalType,
  IntensityLevel,
  PlanQualityMode,
  PregnancyStatus,
  PrimaryGoal,
  SportType,
  TargetMuscleGroup,
  TrainingEquipment,
  TrainingLevel,
  TrainingOutcome
} from '@prisma/client';
import type { NutritionTarget } from '@optime/shared-types';

import { DailyPlanJson } from '../daily-plans/daily-plan-json.schema';
import { HealthPlanningContext } from '../health/health-planning.types';
import { SelectedProtocols } from '../protocol/protocol.types';
import type { ExerciseCandidate } from '../exercise-selection/exercise-selection.types';

export interface GenerateDailyPlanSafetyFeedback {
  riskLevel: 'low' | 'medium' | 'high';
  reasons: string[];
  requiredChanges: string[];
}

export interface GenerateDailyPlanExerciseFeedback {
  reasonCodes: string[];
}

export interface GenerateDailyPlanExerciseSelection {
  candidates: Array<Omit<
    ExerciseCandidate,
    'internalScore' | 'internalReasonCodes' | 'contraindicationTags' | 'exerciseUpdatedAt'
  >>;
  requestedExerciseCount: number;
  workoutDurationMinutes: number;
}

export interface GenerateDailyPlanPersonalizationContext {
  mode: PlanQualityMode;
  contextLevel: 'minimal' | 'personalized' | 'adaptive';
  guidance: string[];
  appMode: GoalImpactMode;
  trainingEnabled: boolean;
  historySummary?: {
    recentPlanCount: number;
    readinessLevels: string[];
    fallbackCount: number;
  };
  feedbackSummary?: {
    helpfulCount: number;
    notHelpfulCount: number;
    commonTags: string[];
  };
  checkInSummary?: {
    recentCheckInCount: number;
    recentSkippedMealsCount: number;
    recentCompletedWorkoutsCount: number;
    recentAverageTiredness: number | null;
    painOrDiscomfortReported: boolean;
    highTirednessReported: boolean;
    illnessLikeNotesReported: boolean;
    conservativeTrainingRecommended: boolean;
  };
  trainingPreference?: {
    targetMuscleGroups: TargetMuscleGroup[];
    trainingOutcome: TrainingOutcome | null;
    equipment: TrainingEquipment[];
    trainingLevel: TrainingLevel | null;
    limitationsOrPainAreas: string[];
    preferredTrainingDays: number[];
    limitationsAreSafetySensitive: boolean;
  };
  trainingPersonalization: {
    usesSchedule: boolean;
    usesTrainingDescriptions: boolean;
    exerciseDetailLevel: 'simple' | 'sets_reps_rest' | 'adaptive';
    futureSignals: string[];
  };
  selectedProtocols?: SelectedProtocols;
  healthPlanningContext?: HealthPlanningContext;
  nutritionTarget?: NutritionTarget;
}

export interface GenerateDailyPlanInput {
  user: {
    id: string;
    firstName: string | null;
    timezone: string;
    isMinor: boolean;
    safeMode: boolean;
  };
  profile: {
    gender: string | null;
    pregnancyStatus: PregnancyStatus;
    dateOfBirth: Date;
    heightCm: number;
    weightKg: number;
    activityLevel: ActivityLevel;
  } | null;
  goal: {
    goalType: GoalType;
    primaryGoal: PrimaryGoal | null;
    targetWeightKg: number | null;
    targetTimelineDays: number | null;
    impactMode: GoalImpactMode | null;
  } | null;
  nutritionPreference: {
    dietType: DietType;
    mealsPerDay: number;
    notes: string | null;
    allergies: string[];
    excludedFoods: string[];
    preferredFoods: string[];
  } | null;
  trainingSchedule: Array<{
    dayOfWeek: number;
    localTime: string;
    sportType: SportType;
    durationMinutes: number;
    intensity: IntensityLevel;
    description: string | null;
  }>;
  safeMode: boolean;
  planLocalDate: string;
  planTimezone: string;
  planQualityMode: PlanQualityMode;
  personalizationContext: GenerateDailyPlanPersonalizationContext;
  exerciseSelection: GenerateDailyPlanExerciseSelection;
  exerciseFeedback?: GenerateDailyPlanExerciseFeedback;
  safetyFeedback?: GenerateDailyPlanSafetyFeedback;
}

export interface AiProvider {
  generateDailyPlan(input: GenerateDailyPlanInput): Promise<DailyPlanJson>;
}
