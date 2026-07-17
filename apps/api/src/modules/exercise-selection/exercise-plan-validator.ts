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
  | 'SESSION_DURATION_TOO_SHORT'
  | 'SESSION_DURATION_TOO_LONG'
  | 'INVALID_REPS'
  | 'MISSING_PRESCRIPTION';

export interface ExercisePlanRepairFeedback {
  affectedExerciseIds: string[];
  sessionTiming: {
    targetMinutes: number;
    estimatedMinutes: number | null;
    minMinutes: number;
    maxMinutes: number;
    warmupMinutes: number;
    cooldownMinutes: number;
    transitionSecondsPerExercise: number;
    suggestedSetsPerExercise: number;
    suggestedRestSeconds: number;
  };
  instructions: string[];
}

export type ExercisePlanValidationResult =
  | { valid: true; planJson: DailyPlanJson }
  | {
      valid: false;
      reasonCodes: ExercisePlanValidationReason[];
      repairFeedback: ExercisePlanRepairFeedback;
    };

export function validateAndNormalizePlannedExercises(
  planJson: DailyPlanJson,
  selection: ExerciseSelectionResult
): ExercisePlanValidationResult {
  const exercises = planJson.training.exercises ?? [];
  if (selection.requestedExerciseCount === 0) {
    return { valid: true, planJson: { ...planJson, training: { ...planJson.training, exercises: [] } } };
  }
  if (exercises.length !== selection.requestedExerciseCount) {
    return invalidResult(['MISSING_EXERCISES'], exercises, selection);
  }

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

  if (reasons.size) return invalidResult([...reasons], exercises, selection);

  const sessionTiming = estimateSessionTiming(trusted, selection);
  if (sessionTiming.estimatedMinutes < sessionTiming.minMinutes) {
    return invalidResult(['SESSION_DURATION_TOO_SHORT'], trusted, selection, sessionTiming);
  }
  if (sessionTiming.estimatedMinutes > sessionTiming.maxMinutes) {
    return invalidResult(['SESSION_DURATION_TOO_LONG'], trusted, selection, sessionTiming);
  }
  return {
    valid: true,
    planJson: { ...planJson, training: { ...planJson.training, exercises: trusted } }
  };
}

function invalidResult(
  reasonCodes: ExercisePlanValidationReason[],
  exercises: NonNullable<DailyPlanJson['training']['exercises']>,
  selection: ExerciseSelectionResult,
  sessionTiming = estimateSessionTiming(exercises, selection)
): ExercisePlanValidationResult {
  return {
    valid: false,
    reasonCodes,
    repairFeedback: {
      affectedExerciseIds: exercises
        .map((exercise) => exercise.exerciseId)
        .filter((exerciseId): exerciseId is string => Boolean(exerciseId)),
      sessionTiming,
      instructions: [
        `Return exactly ${selection.requestedExerciseCount} allowed exercises.`,
        `Keep the full session within ${sessionTiming.minMinutes}-${sessionTiming.maxMinutes} minutes, including warm-up, cooldown, and transitions.`,
        `Use ${selection.volumePlan.suggestedSetsPerExercise} sets and about ${selection.volumePlan.suggestedRestSeconds} seconds of rest for strength exercises unless a safety constraint requires less volume.`,
        'Respect pain, limitations, fatigue, and conservative recovery context; do not increase intensity to fill time.'
      ]
    }
  };
}

function estimateSessionTiming(
  exercises: NonNullable<DailyPlanJson['training']['exercises']>,
  selection: ExerciseSelectionResult
) {
  const volume = selection.volumePlan;
  const exerciseSeconds = exercises.reduce((total, exercise) => (
    total + estimateExerciseSeconds(exercise, volume.transitionSecondsPerExercise)
  ), 0);
  const estimatedMinutes = Math.round((
    volume.warmupMinutes * 60 +
    volume.cooldownMinutes * 60 +
    exerciseSeconds
  ) / 60);
  const safetyReduced = volume.volumeReasonCodes.some((reason) => (
    reason.endsWith('_REDUCTION') || reason === 'RECOVERY_PROTOCOL_REDUCTION'
  ));
  const minimumFromPlan = Math.max(8, Math.floor(volume.estimatedSessionMinutes * 0.75));
  const minimumFromRequestedDuration = safetyReduced
    ? 0
    : Math.floor(selection.workoutDurationMinutes * 0.65);

  return {
    targetMinutes: selection.workoutDurationMinutes,
    estimatedMinutes,
    minMinutes: Math.max(minimumFromPlan, minimumFromRequestedDuration),
    maxMinutes: Math.max(
      selection.workoutDurationMinutes,
      Math.ceil(selection.workoutDurationMinutes * 1.2)
    ),
    warmupMinutes: volume.warmupMinutes,
    cooldownMinutes: volume.cooldownMinutes,
    transitionSecondsPerExercise: volume.transitionSecondsPerExercise,
    suggestedSetsPerExercise: volume.suggestedSetsPerExercise,
    suggestedRestSeconds: volume.suggestedRestSeconds
  };
}

function estimateExerciseSeconds(
  exercise: NonNullable<DailyPlanJson['training']['exercises']>[number],
  transitionSeconds: number
) {
  const exerciseDuration = parseDurationSeconds(exercise.duration);
  if (exerciseDuration !== null) return exerciseDuration + transitionSeconds;

  const sets = parseWholeNumber(exercise.sets) ?? 0;
  const reps = parseAverageReps(exercise.reps) ?? 0;
  const restSeconds = parseDurationSeconds(exercise.rest) ?? 0;
  const workSecondsPerSet = Math.max(30, Math.min(75, reps * 5));
  return (
    sets * workSecondsPerSet +
    Math.max(0, sets - 1) * restSeconds +
    transitionSeconds
  );
}

function parseWholeNumber(value: string | undefined) {
  return value && /^\d+$/.test(value.trim()) ? Number(value.trim()) : null;
}

function parseAverageReps(value: string | undefined) {
  const match = value?.trim().match(/^(\d{1,2})(?:-(\d{1,2}))?(?: per side)?$/i);
  if (!match) return null;
  return (Number(match[1]) + Number(match[2] ?? match[1])) / 2;
}

function parseDurationSeconds(value: string | undefined) {
  if (!value) return null;
  const seconds = value.trim().match(/^(\d{1,3})(?:-(\d{1,3}))? seconds$/i);
  if (seconds) return (Number(seconds[1]) + Number(seconds[2] ?? seconds[1])) / 2;
  const minutes = value.trim().match(/^(\d{1,3})(?:-(\d{1,3}))? minutes$/i);
  if (minutes) return ((Number(minutes[1]) + Number(minutes[2] ?? minutes[1])) / 2) * 60;
  return null;
}

export function composeDeterministicFallbackWorkout(
  planJson: DailyPlanJson,
  selection: ExerciseSelectionResult
): DailyPlanJson {
  const exercises = selection.candidates
    .slice(0, selection.requestedExerciseCount)
    .map((candidate) => toTrustedExercise(fallbackPrescription(candidate, selection), candidate));
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

function fallbackPrescription(candidate: ExerciseCandidate, selection: ExerciseSelectionResult) {
  const workoutDurationMinutes = selection.workoutDurationMinutes;
  const sets = selection.volumePlan.suggestedSetsPerExercise || 2;
  const restSeconds = selection.volumePlan.suggestedRestSeconds || 60;
  if (candidate.category === ExerciseCategory.STRENGTH) {
    return {
      sets: String(Math.max(1, Math.min(5, sets))),
      reps: '8-10',
      rest: `${restSeconds} seconds`,
      intensityCue: 'Move with steady control and keep effort comfortable.',
      notes: `Planned for a ${workoutDurationMinutes}-minute session with safe pacing.`
    };
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
