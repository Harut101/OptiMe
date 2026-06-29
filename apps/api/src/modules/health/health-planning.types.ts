import { HealthProvider } from '@prisma/client';

export type HealthDataSource = 'APPLE_HEALTH' | 'HEALTH_CONNECT' | 'WHOOP' | 'MANUAL' | 'MOCK';
export type WearableActivityLevelHint = 'LOW' | 'MODERATE' | 'HIGH' | 'UNKNOWN';
export type WearableSleepHint = 'LOW_SLEEP' | 'OK_SLEEP' | 'UNKNOWN';
export type WearableRecoveryHint =
  | 'RECOVERY_DATA_AVAILABLE'
  | 'LIMITED_RECOVERY_DATA'
  | 'UNKNOWN';
export type WearablePlanningReasonCode =
  | 'NO_WEARABLE_DATA'
  | 'STALE_WEARABLE_DATA'
  | 'PARTIAL_WEARABLE_DATA'
  | 'LOW_SLEEP'
  | 'OK_SLEEP'
  | 'HIGH_ACTIVITY'
  | 'MODERATE_ACTIVITY'
  | 'RECENT_WORKOUT_LOAD'
  | 'RECOVERY_DATA_AVAILABLE'
  | 'LIMITED_RECOVERY_DATA'
  | 'APPLE_HEALTH_NO_RECOVERY_SCORE';
export type TrainingLoadReadinessHint =
  | 'NORMAL'
  | 'CONTROLLED'
  | 'LIGHT'
  | 'RECOVERY_FOCUSED'
  | 'UNKNOWN';
export type TrainingLoadReasonCode =
  | 'LOW_SLEEP'
  | 'HIGH_ACTIVITY'
  | 'RECENT_WORKOUT_LOAD'
  | 'PARTIAL_WEARABLE_DATA'
  | 'STALE_WEARABLE_DATA'
  | 'NO_WEARABLE_DATA';

export interface WearablePlanningContext {
  hasWearableData: boolean;
  source: HealthDataSource | null;
  localDate: string | null;
  isStale: boolean;
  activity: {
    steps: number | null;
    activeCaloriesKcal: number | null;
    workoutMinutes: number | null;
    activityLevelHint: WearableActivityLevelHint;
  };
  sleep: {
    sleepMinutes: number | null;
    sleepHint: WearableSleepHint;
  };
  recovery: {
    recoveryScore: number | null;
    strainScore: number | null;
    restingHeartRateBpm: number | null;
    hrvMs: number | null;
    respiratoryRate: number | null;
    recoveryHint: WearableRecoveryHint;
  };
  reasonCodes: WearablePlanningReasonCode[];
}

export interface TrainingLoadContext {
  hasTrainingLoadContext: boolean;
  readinessHint: TrainingLoadReadinessHint;
  reasons: TrainingLoadReasonCode[];
  suggestedAdjustment: {
    intensity: 'NORMAL' | 'REDUCE' | 'UNKNOWN';
    volume: 'NORMAL' | 'REDUCE' | 'UNKNOWN';
    restTime: 'NORMAL' | 'INCREASE' | 'UNKNOWN';
  };
  userFacingHint: string | null;
}

export const EMPTY_WEARABLE_PLANNING_CONTEXT: WearablePlanningContext = {
  hasWearableData: false,
  source: null,
  localDate: null,
  isStale: false,
  activity: {
    steps: null,
    activeCaloriesKcal: null,
    workoutMinutes: null,
    activityLevelHint: 'UNKNOWN'
  },
  sleep: {
    sleepMinutes: null,
    sleepHint: 'UNKNOWN'
  },
  recovery: {
    recoveryScore: null,
    strainScore: null,
    restingHeartRateBpm: null,
    hrvMs: null,
    respiratoryRate: null,
    recoveryHint: 'UNKNOWN'
  },
  reasonCodes: ['NO_WEARABLE_DATA']
};

export const EMPTY_TRAINING_LOAD_CONTEXT: TrainingLoadContext = {
  hasTrainingLoadContext: false,
  readinessHint: 'UNKNOWN',
  reasons: ['NO_WEARABLE_DATA'],
  suggestedAdjustment: {
    intensity: 'UNKNOWN',
    volume: 'UNKNOWN',
    restTime: 'UNKNOWN'
  },
  userFacingHint: null
};

export interface HealthPlanningContext {
  available: boolean;
  daysReviewed: number;
  wearableContext?: {
    source: HealthProvider;
    hasRecentData: boolean;
    isStale: boolean;
    localDate: string;
    steps?: number;
    activeCaloriesKcal?: number;
    workoutMinutes?: number;
    sleepMinutes?: number;
    sleepQualityScore?: number;
    recoveryScore?: number;
    strainScore?: number;
    restingHeartRateBpm?: number;
    hrvMs?: number;
    respiratoryRate?: number;
  };
  wearablePlanningContext: WearablePlanningContext;
  trainingLoadContext: TrainingLoadContext;
  latestSummary?: {
    localDate: string;
    steps?: number;
    sleepMinutes?: number;
    activeEnergyKcal?: number;
    workoutCount?: number;
    workoutMinutes?: number;
  };
  recentAverages?: {
    steps?: number;
    sleepMinutes?: number;
    activeEnergyKcal?: number;
    workoutMinutes?: number;
  };
  signals: {
    lowSleep: boolean;
    highActivityYesterday: boolean;
    recentWorkout: boolean;
    lowStepTrend: boolean;
  };
  selectionNotes: string[];
}

export const EMPTY_HEALTH_PLANNING_CONTEXT: HealthPlanningContext = {
  available: false,
  daysReviewed: 0,
  signals: {
    lowSleep: false,
    highActivityYesterday: false,
    recentWorkout: false,
    lowStepTrend: false
  },
  wearablePlanningContext: EMPTY_WEARABLE_PLANNING_CONTEXT,
  trainingLoadContext: EMPTY_TRAINING_LOAD_CONTEXT,
  selectionNotes: []
};
