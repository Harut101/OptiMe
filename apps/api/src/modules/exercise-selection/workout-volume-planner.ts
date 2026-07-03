import { PregnancyStatus, TrainingLevel } from '@prisma/client';

import type { ExerciseSelectionContext, WorkoutVolumePlan, WorkoutVolumeReasonCode } from './exercise-selection.types';

const RECOVERY_PROTOCOLS = new Set(['RECOVERY', 'CONSERVATIVE_PAIN_LIMITATION', 'NO_TRAINING_PLANNED']);
const PREGNANCY_SENSITIVE_STATUSES = new Set<PregnancyStatus>([
  PregnancyStatus.PREGNANT,
  PregnancyStatus.POSTPARTUM,
  PregnancyStatus.BREASTFEEDING
]);

export class WorkoutVolumePlanner {
  plan(context: ExerciseSelectionContext): WorkoutVolumePlan {
    const duration = Math.max(0, Math.trunc(context.workoutDurationMinutes ?? 30));
    const reasons: WorkoutVolumeReasonCode[] = [];

    if (context.protocol.id === 'NO_TRAINING_PLANNED' || duration <= 0) {
      return this.emptyPlan(duration, context.protocol.id === 'NO_TRAINING_PLANNED' ? 'NO_TRAINING_PLANNED' : 'REST_DAY');
    }

    let range = this.baseRange(duration, reasons);

    if (context.trainingLevel === TrainingLevel.BEGINNER && duration >= 50) {
      range = reduceRange(range, 1, 3);
      reasons.push('BEGINNER_REDUCTION');
    }

    if (context.safeMode) {
      range = reduceRange(range, 1, 2);
      reasons.push('SAFE_MODE_REDUCTION');
    }

    if (context.isMinor) {
      range = reduceRange(range, 1, 2);
      reasons.push('MINOR_REDUCTION');
    }

    if (context.pregnancyStatus && PREGNANCY_SENSITIVE_STATUSES.has(context.pregnancyStatus)) {
      range = reduceRange(range, 1, 2);
      reasons.push('PREGNANCY_CONTEXT_REDUCTION');
    }

    if (context.limitationsPresent) {
      range = reduceRange(range, 1, 2);
      reasons.push('LIMITATION_REDUCTION');
    }

    if (context.healthSignals.lowSleep) {
      range = reduceRange(range, 1, 2);
      reasons.push('LOW_SLEEP_REDUCTION');
    }

    if (context.healthSignals.highActivity) {
      range = reduceRange(range, 1, 2);
      reasons.push('HIGH_ACTIVITY_REDUCTION');
    }

    if (RECOVERY_PROTOCOLS.has(context.protocol.id)) {
      range = { min: 1, target: Math.min(range.target, 3), max: Math.min(range.max, 3) };
      reasons.push('RECOVERY_PROTOCOL_REDUCTION');
    }

    const suggestedSetsPerExercise = getSuggestedSets(duration, context.trainingLevel, reasons);
    const suggestedRestSeconds = getSuggestedRestSeconds(duration, reasons);
    const warmupMinutes = duration >= 50 ? 8 : duration >= 35 ? 6 : 4;
    const cooldownMinutes = duration >= 50 ? 5 : duration >= 35 ? 4 : 3;
    const transitionSecondsPerExercise = 45;
    const estimatedSessionMinutes = estimateSessionMinutes({
      targetExerciseCount: range.target,
      suggestedSetsPerExercise,
      suggestedRestSeconds,
      warmupMinutes,
      cooldownMinutes,
      transitionSecondsPerExercise
    });

    return {
      targetExerciseCount: range.target,
      minExerciseCount: range.min,
      maxExerciseCount: range.max,
      suggestedSetsPerExercise,
      suggestedRestSeconds,
      estimatedSessionMinutes,
      warmupMinutes,
      cooldownMinutes,
      transitionSecondsPerExercise,
      volumeReasonCodes: reasons
    };
  }

  withAvailableCandidateCount(plan: WorkoutVolumePlan, availableCandidateCount: number): WorkoutVolumePlan {
    if (availableCandidateCount >= plan.targetExerciseCount) return plan;
    const targetExerciseCount = Math.max(0, Math.min(plan.targetExerciseCount, availableCandidateCount));
    return {
      ...plan,
      targetExerciseCount,
      minExerciseCount: Math.min(plan.minExerciseCount, targetExerciseCount),
      maxExerciseCount: Math.min(plan.maxExerciseCount, targetExerciseCount),
      estimatedSessionMinutes: Math.min(plan.estimatedSessionMinutes, Math.max(0, plan.estimatedSessionMinutes)),
      volumeReasonCodes: [...new Set([...plan.volumeReasonCodes, 'NOT_ENOUGH_SAFE_EXERCISES' as const])]
    };
  }

  private emptyPlan(duration: number, reason: WorkoutVolumeReasonCode): WorkoutVolumePlan {
    return {
      targetExerciseCount: 0,
      minExerciseCount: 0,
      maxExerciseCount: 0,
      suggestedSetsPerExercise: 0,
      suggestedRestSeconds: 0,
      estimatedSessionMinutes: 0,
      warmupMinutes: duration > 0 ? 3 : 0,
      cooldownMinutes: duration > 0 ? 3 : 0,
      transitionSecondsPerExercise: 0,
      volumeReasonCodes: [reason]
    };
  }

  private baseRange(duration: number, reasons: WorkoutVolumeReasonCode[]) {
    if (duration <= 25) { reasons.push('DURATION_15_25'); return { min: 2, target: 2, max: 3 }; }
    if (duration <= 35) { reasons.push('DURATION_25_35'); return { min: 3, target: 4, max: 4 }; }
    if (duration <= 50) { reasons.push('DURATION_35_50'); return { min: 4, target: 5, max: 5 }; }
    if (duration <= 65) { reasons.push('DURATION_50_65'); return { min: 5, target: 6, max: 6 }; }
    if (duration <= 80) { reasons.push('DURATION_65_80'); return { min: 6, target: 7, max: 7 }; }
    reasons.push('DURATION_80_95');
    return { min: 7, target: 8, max: 8 };
  }
}

function reduceRange(range: { min: number; target: number; max: number }, amount: number, floor: number) {
  return {
    min: Math.max(floor, range.min - amount),
    target: Math.max(floor, range.target - amount),
    max: Math.max(floor, range.max - amount)
  };
}

function getSuggestedSets(duration: number, trainingLevel: TrainingLevel, reasons: WorkoutVolumeReasonCode[]) {
  const safetyReduced = reasons.some((reason) => reason.endsWith('_REDUCTION'));
  if (safetyReduced) return 2;
  if (trainingLevel === TrainingLevel.ADVANCED && duration >= 60) return 4;
  return duration >= 45 ? 3 : 2;
}

function getSuggestedRestSeconds(duration: number, reasons: WorkoutVolumeReasonCode[]) {
  if (reasons.includes('LOW_SLEEP_REDUCTION') || reasons.includes('HIGH_ACTIVITY_REDUCTION')) return 90;
  return duration >= 60 ? 75 : 60;
}

function estimateSessionMinutes(input: {
  targetExerciseCount: number;
  suggestedSetsPerExercise: number;
  suggestedRestSeconds: number;
  warmupMinutes: number;
  cooldownMinutes: number;
  transitionSecondsPerExercise: number;
}) {
  const workSecondsPerSet = 40;
  const exerciseSeconds =
    input.targetExerciseCount *
    (input.suggestedSetsPerExercise * workSecondsPerSet +
      Math.max(0, input.suggestedSetsPerExercise - 1) * input.suggestedRestSeconds +
      input.transitionSecondsPerExercise);
  return Math.round(input.warmupMinutes + input.cooldownMinutes + exerciseSeconds / 60);
}
