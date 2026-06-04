import {
  ActivityLevel,
  DietType,
  GoalImpactMode,
  GoalType,
  IntensityLevel,
  SportType
} from '@prisma/client';

import { DailyPlanJson } from '../daily-plans/daily-plan-json.schema';

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
}

export interface AiProvider {
  generateDailyPlan(input: GenerateDailyPlanInput): Promise<DailyPlanJson>;
}
