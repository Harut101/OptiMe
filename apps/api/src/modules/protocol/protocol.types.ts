import {
  GoalImpactMode,
  GoalType,
  PlanQualityMode,
  PregnancyStatus,
  TrainingEquipment,
  TrainingLevel,
  TrainingOutcome
} from '@prisma/client';

export type TrainingProtocolIntensity = 'REST' | 'LIGHT' | 'MODERATE' | 'HARD';

export type NutritionProtocolId =
  | 'SAFE_WEIGHT_LOSS'
  | 'MUSCLE_GAIN'
  | 'MAINTENANCE'
  | 'HEALTHY_LIFESTYLE'
  | 'PREGNANCY_POSTPARTUM_SAFE'
  | 'UNDER_18_SAFE'
  | 'RECOVERY_DAY';

export type TrainingProtocolId =
  | 'STRENGTH'
  | 'MUSCLE_GROWTH'
  | 'ENDURANCE'
  | 'MOBILITY'
  | 'RECOVERY'
  | 'BEGINNER_GYM'
  | 'HOME_WORKOUT'
  | 'NO_TRAINING_PLANNED'
  | 'CONSERVATIVE_PAIN_LIMITATION';

export type RecoveryProtocolId =
  | 'NORMAL_RECOVERY'
  | 'HIGH_TIREDNESS'
  | 'PAIN_OR_DISCOMFORT'
  | 'PREGNANCY_POSTPARTUM_CONSERVATIVE'
  | 'REST_DAY'
  | 'HIGH_SORENESS';

export interface NutritionProtocol {
  id: NutritionProtocolId;
  title: string;
  rules: string[];
  safetyRules: string[];
}

export interface TrainingProtocol {
  id: TrainingProtocolId;
  title: string;
  recommendedIntensity: TrainingProtocolIntensity;
  exerciseGuidance: string[];
  safetyRules: string[];
}

export interface RecoveryProtocol {
  id: RecoveryProtocolId;
  title: string;
  rules: string[];
  safetyRules: string[];
}

export interface SelectedProtocols {
  nutritionProtocol: NutritionProtocol;
  trainingProtocol: TrainingProtocol;
  recoveryProtocol: RecoveryProtocol;
  selectionReasons: string[];
}

export interface ProtocolSelectionInput {
  profile: {
    pregnancyStatus: PregnancyStatus;
  } | null;
  goal: {
    goalType: GoalType;
    targetWeightKg: number | null;
    targetTimelineDays: number | null;
    impactMode: GoalImpactMode | null;
  } | null;
  safeMode: boolean;
  isMinor: boolean;
  noTrainingPlanned: boolean;
  trainingSchedule: Array<{
    durationMinutes: number;
    intensity: string;
    description: string | null;
  }>;
  trainingPreference?: {
    trainingOutcome: TrainingOutcome | null;
    equipment: TrainingEquipment[];
    trainingLevel: TrainingLevel | null;
    limitationsOrPainAreas: string[];
  } | null;
  checkInSummary?: {
    recentAverageTiredness: number | null;
    painOrDiscomfortReported: boolean;
    highTirednessReported: boolean;
    conservativeTrainingRecommended: boolean;
  };
  planQualityMode: PlanQualityMode;
}
