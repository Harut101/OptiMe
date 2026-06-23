import { ExerciseCategory } from '@prisma/client';

import type { DailyPlanJson } from '../daily-plans/daily-plan-json.schema';
import type { ExerciseCandidate, ExerciseSelectionResult } from './exercise-selection.types';

export type ExercisePlanValidationReason =
  | 'MISSING_EXERCISES'
  | 'UNKNOWN_EXERCISE_ID'
  | 'EXERCISE_NOT_ALLOWED'
  | 'SLUG_MISMATCH'
  | 'DUPLICATE_EXERCISE'
  | 'SETS_OUT_OF_RANGE'
  | 'REST_OUT_OF_RANGE'
  | 'DURATION_OUT_OF_RANGE'
  | 'INVALID_REPS'
  | 'MISSING_PRESCRIPTION';

export type ExercisePlanValidationResult =
  | { valid: true; planJson: DailyPlanJson }
  | { valid: false; reasonCodes: ExercisePlanValidationReason[] };

export function validateAndNormalizePlannedExercises(
  planJson: DailyPlanJson,
  selection: ExerciseSelectionResult
): ExercisePlanValidationResult {
  const exercises = planJson.training.exercises ?? [];
  if (selection.requestedExerciseCount === 0) {
    return { valid: true, planJson: { ...planJson, training: { ...planJson.training, exercises: [] } } };
  }
  if (exercises.length !== selection.requestedExerciseCount) return { valid: false, reasonCodes: ['MISSING_EXERCISES'] };

  const allowed = new Map(selection.candidates.map((candidate) => [candidate.exerciseId, candidate]));
  const seen = new Set<string>();
  const reasons = new Set<ExercisePlanValidationReason>();
  const trusted = exercises.slice(0, selection.requestedExerciseCount).flatMap((exercise) => {
    if (!exercise.exerciseId) { reasons.add('UNKNOWN_EXERCISE_ID'); return []; }
    const candidate = allowed.get(exercise.exerciseId);
    if (!candidate) { reasons.add('EXERCISE_NOT_ALLOWED'); return []; }
    if (exercise.slug !== candidate.slug) reasons.add('SLUG_MISMATCH');
    if (seen.has(candidate.exerciseId)) { reasons.add('DUPLICATE_EXERCISE'); return []; }
    seen.add(candidate.exerciseId);
    for (const reason of validatePrescription(exercise, candidate, selection.workoutDurationMinutes)) reasons.add(reason);
    return [toTrustedExercise(exercise, candidate)];
  });

  if (reasons.size) return { valid: false, reasonCodes: [...reasons] };
  return {
    valid: true,
    planJson: { ...planJson, training: { ...planJson.training, exercises: trusted } }
  };
}

export function composeDeterministicFallbackWorkout(
  planJson: DailyPlanJson,
  selection: ExerciseSelectionResult
): DailyPlanJson {
  const exercises = selection.candidates
    .slice(0, selection.requestedExerciseCount)
    .map((candidate) => toTrustedExercise(fallbackPrescription(candidate, selection.workoutDurationMinutes), candidate));
  return { ...planJson, training: { ...planJson.training, exercises } };
}

function validatePrescription(
  exercise: NonNullable<DailyPlanJson['training']['exercises']>[number],
  candidate: ExerciseCandidate,
  workoutDurationMinutes: number
) {
  const reasons: ExercisePlanValidationReason[] = [];
  if (candidate.category === ExerciseCategory.STRENGTH) {
    if (!exercise.sets || !/^[1-5]$/.test(exercise.sets)) reasons.push('SETS_OUT_OF_RANGE');
    if (!exercise.reps || !isValidReps(exercise.reps)) reasons.push('INVALID_REPS');
    if (!exercise.rest || !isValidRange(exercise.rest, 'seconds', 15, 300)) reasons.push('REST_OUT_OF_RANGE');
  } else {
    if (!exercise.duration) reasons.push('MISSING_PRESCRIPTION');
  }
  if (exercise.duration && !isValidDuration(exercise.duration, workoutDurationMinutes)) reasons.push('DURATION_OUT_OF_RANGE');
  if (exercise.reps && /failure|max(?:imum)? effort|amrap|as many/i.test(exercise.reps)) reasons.push('INVALID_REPS');
  return reasons;
}

function isValidReps(value: string) {
  const match = value.trim().match(/^(\d{1,2})(?:-(\d{1,2}))?(?: per side)?$/i);
  if (!match) return false;
  const min = Number(match[1]);
  const max = Number(match[2] ?? match[1]);
  return min >= 1 && max >= min && max <= 30;
}

function isValidRange(value: string, unit: 'seconds' | 'minutes', min: number, max: number) {
  const match = value.trim().match(new RegExp(`^(\\d{1,3})(?:-(\\d{1,3}))? ${unit}$`, 'i'));
  if (!match) return false;
  const low = Number(match[1]);
  const high = Number(match[2] ?? match[1]);
  return low >= min && high >= low && high <= max;
}

function isValidDuration(value: string, workoutDurationMinutes: number) {
  return isValidRange(value, 'seconds', 15, Math.max(15, workoutDurationMinutes * 60)) ||
    isValidRange(value, 'minutes', 1, Math.max(1, workoutDurationMinutes));
}

function fallbackPrescription(candidate: ExerciseCandidate, workoutDurationMinutes: number) {
  if (candidate.category === ExerciseCategory.STRENGTH) {
    return { sets: '2', reps: '8-10', rest: '60 seconds', intensityCue: 'Move with steady control and keep effort comfortable.', notes: 'Use a comfortable range.' };
  }
  if (candidate.category === ExerciseCategory.CARDIO) {
    return { duration: `${Math.max(1, Math.min(10, workoutDurationMinutes))} minutes`, intensityCue: 'Choose a sustainable, conversational pace.', notes: 'Reduce the pace whenever needed.' };
  }
  return { duration: `${Math.max(1, Math.min(5, workoutDurationMinutes))} minutes`, intensityCue: 'Keep the movement gentle and controlled.', notes: 'Use support if it improves comfort.' };
}

function toTrustedExercise(
  prescription: NonNullable<DailyPlanJson['training']['exercises']>[number] | ReturnType<typeof fallbackPrescription>,
  candidate: ExerciseCandidate
): NonNullable<DailyPlanJson['training']['exercises']>[number] {
  return {
    exerciseId: candidate.exerciseId,
    slug: candidate.slug,
    name: candidate.name,
    targetMuscles: candidate.targetMuscles,
    equipment: candidate.equipment,
    ...(prescription.sets ? { sets: prescription.sets } : {}),
    ...(prescription.reps ? { reps: prescription.reps } : {}),
    ...(prescription.rest ? { rest: prescription.rest } : {}),
    ...(prescription.duration ? { duration: prescription.duration } : {}),
    ...(prescription.intensityCue ? { intensityCue: prescription.intensityCue } : {}),
    safetyNotes: candidate.safetyNotes.join(' ').slice(0, 220),
    ...('notes' in prescription && prescription.notes ? { notes: prescription.notes } : {}),
    exerciseSnapshot: {
      resolvedLocale: candidate.resolvedLocale,
      category: candidate.category,
      movementPattern: candidate.movementPattern,
      equipment: candidate.equipment,
      targetMuscles: candidate.targetMuscles,
      secondaryMuscles: candidate.secondaryMuscles,
      instructions: candidate.instructions,
      coachingCues: candidate.coachingCues,
      safetyNotes: candidate.safetyNotes,
      exerciseUpdatedAt: candidate.exerciseUpdatedAt
    }
  };
}
