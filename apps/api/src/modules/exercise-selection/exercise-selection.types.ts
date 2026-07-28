import type {
  ExerciseCategory,
  ExerciseContraindicationTag,
  ExerciseEquipment,
  MovementPattern,
  PlanQualityMode,
  PregnancyStatus,
  TargetMuscleGroup,
  TrainingLevel
} from '@prisma/client';
import type { SupportedLocale } from '@optime/shared-types';

import type { TrainingProtocol } from '../protocol/protocol.types';

export type ExerciseSelectionReason =
  | 'EXACT_TARGET_MATCH'
  | 'SECONDARY_TARGET_MATCH'
  | 'PATTERN_MATCH'
  | 'PROTOCOL_CATEGORY_MATCH'
  | 'EQUIPMENT_MATCH'
  | 'LEVEL_MATCH'
  | 'LOW_COMPLEXITY_PREFERENCE'
  | 'HEALTH_RECOVERY_PREFERENCE'
  | 'LOW_STEP_ACCESSIBLE_MOVEMENT'
  | 'MEDIA_AVAILABLE';

export type ExerciseExclusionReason =
  | 'EQUIPMENT_UNAVAILABLE'
  | 'LEVEL_UNSUPPORTED'
  | 'PREGNANCY_REVIEW_REQUIRED'
  | 'POSTPARTUM_REVIEW_REQUIRED'
  | 'HIGH_IMPACT_RECOVERY_CONTEXT';

export type ExerciseSelectionFallbackMode =
  | 'NONE'
  | 'BODYWEIGHT_ONLY'
  | 'RECOVERY_FOCUSED'
  | 'MINIMAL_SAFE_POOL'
  | 'NOT_ENOUGH_SAFE_EXERCISES';

export type WorkoutVolumeReasonCode =
  | 'DURATION_15_25'
  | 'DURATION_25_35'
  | 'DURATION_35_50'
  | 'DURATION_50_65'
  | 'DURATION_65_80'
  | 'DURATION_80_95'
  | 'BEGINNER_REDUCTION'
  | 'SAFE_MODE_REDUCTION'
  | 'MINOR_REDUCTION'
  | 'PREGNANCY_CONTEXT_REDUCTION'
  | 'LIMITATION_REDUCTION'
  | 'LOW_SLEEP_REDUCTION'
  | 'LOW_RECOVERY_REDUCTION'
  | 'HIGH_ACTIVITY_REDUCTION'
  | 'RECOVERY_PROTOCOL_REDUCTION'
  | 'NO_TRAINING_PLANNED'
  | 'REST_DAY'
  | 'NOT_ENOUGH_SAFE_EXERCISES';

export interface WorkoutVolumePlan {
  targetExerciseCount: number;
  minExerciseCount: number;
  maxExerciseCount: number;
  suggestedSetsPerExercise: number;
  suggestedRestSeconds: number;
  estimatedSessionMinutes: number;
  warmupMinutes: number;
  cooldownMinutes: number;
  transitionSecondsPerExercise: number;
  volumeReasonCodes: WorkoutVolumeReasonCode[];
}

export interface ExerciseSelectionContext {
  locale: SupportedLocale;
  planDate: string;
  protocol: TrainingProtocol;
  environment?: 'GYM' | 'HOME' | 'OUTDOOR';
  availableEquipment: ExerciseEquipment[];
  trainingLevel: TrainingLevel;
  targetMuscles: TargetMuscleGroup[];
  workoutDurationMinutes?: number;
  limitationsPresent: boolean;
  pregnancyStatus?: PregnancyStatus | null;
  safeMode: boolean;
  isMinor: boolean;
  healthSignals: {
    lowSleep: boolean;
    lowRecovery: boolean;
    highActivity: boolean;
    lowStepTrend: boolean;
  };
  qualityMode: PlanQualityMode;
}

export interface ExerciseCandidate {
  exerciseId: string;
  slug: string;
  name: string;
  resolvedLocale: SupportedLocale;
  category: ExerciseCategory;
  movementPattern: MovementPattern;
  equipment: ExerciseEquipment[];
  targetMuscles: TargetMuscleGroup[];
  secondaryMuscles: TargetMuscleGroup[];
  instructions: string[];
  coachingCues: string[];
  safetyNotes: string[];
  contraindicationTags: ExerciseContraindicationTag[];
  hasMedia: boolean;
  exerciseUpdatedAt: string;
  internalScore: number;
  internalReasonCodes: ExerciseSelectionReason[];
}

export interface ExerciseSelectionResult {
  candidates: ExerciseCandidate[];
  requestedExerciseCount: number;
  minExerciseCount: number;
  maxExerciseCount: number;
  candidatePoolLimit: number;
  workoutDurationMinutes: number;
  volumePlan: WorkoutVolumePlan;
  normalizedTargetMuscles: TargetMuscleGroup[];
  fallbackMode: ExerciseSelectionFallbackMode;
  internalExclusionSummary: Partial<Record<ExerciseExclusionReason, number>>;
}
