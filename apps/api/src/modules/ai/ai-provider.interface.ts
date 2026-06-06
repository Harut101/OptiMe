import {
  ActivityLevel,
  DietType,
  GoalImpactMode,
  GoalType,
  IntensityLevel,
  PlanQualityMode,
  PregnancyStatus,
  SportType
} from '@prisma/client';

import { DailyPlanJson } from '../daily-plans/daily-plan-json.schema';

export interface GenerateDailyPlanSafetyFeedback {
  riskLevel: 'low' | 'medium' | 'high';
  reasons: string[];
  requiredChanges: string[];
}

export interface GenerateDailyPlanPersonalizationContext {
  mode: PlanQualityMode;
  contextLevel: 'minimal' | 'personalized' | 'adaptive';
  guidance: string[];
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
  trainingPersonalization: {
    usesSchedule: boolean;
    usesTrainingDescriptions: boolean;
    exerciseDetailLevel: 'simple' | 'sets_reps_rest' | 'adaptive';
    futureSignals: string[];
  };
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
  safetyFeedback?: GenerateDailyPlanSafetyFeedback;
}

export interface AiProvider {
  generateDailyPlan(input: GenerateDailyPlanInput): Promise<DailyPlanJson>;
}
