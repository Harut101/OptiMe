import type { TFunction } from 'i18next';
import type { TargetMuscleGroup, WorkoutSessionSummary } from '@/types/api';

import { getMuscleGroupLabel } from '@/i18n/enum-labels';

const MUSCLE_GROUPS = new Set<TargetMuscleGroup>([
  'CHEST',
  'TRAPS',
  'LATS',
  'LOWER_BACK',
  'ABS',
  'OBLIQUES',
  'BICEPS',
  'TRICEPS',
  'FOREARMS',
  'QUADRICEPS',
  'HAMSTRINGS',
  'ADDUCTORS',
  'ABDUCTORS',
  'CALVES',
  'BACK',
  'LEGS',
  'GLUTES',
  'CORE',
  'SHOULDERS',
  'ARMS',
  'FULL_BODY'
]);

export function formatWorkoutFocus(summary: WorkoutSessionSummary, t: TFunction) {
  const labels = summary.primaryMuscleGroups
    .slice(0, 3)
    .map((item) => formatMuscleGroup(item, t))
    .filter(Boolean);

  return labels.length ? labels.join(' + ') : t('workout.workoutCompleted');
}

export function formatWorkoutSetCount(summary: WorkoutSessionSummary, t: TFunction) {
  return t('workout.setsCompleted', {
    completed: String(summary.completedSetCount),
    total: String(summary.plannedSetCount)
  });
}

export function formatWorkoutExerciseCount(summary: WorkoutSessionSummary, t: TFunction) {
  return t('workout.exercisesCompleted', {
    completed: String(summary.completedExerciseCount),
    total: String(summary.plannedExerciseCount)
  });
}

export function formatWorkoutDate(localDate: string, locale?: string) {
  const date = new Date(`${localDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return localDate;
  return date.toLocaleDateString(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });
}

export function formatWorkoutTime(value: string | null, locale?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit'
  });
}

export function getWorkoutAccessibilityLabel(summary: WorkoutSessionSummary, t: TFunction) {
  const focus = formatWorkoutFocus(summary, t);
  const partial = summary.isPartial ? `, ${t('workout.partial')}` : '';
  return `${t('workout.workoutCompleted')}, ${focus}, ${formatWorkoutSetCount(summary, t)}${partial}. ${t('workout.openCompletedWorkout')}`;
}

function formatMuscleGroup(value: string, t: TFunction) {
  if (MUSCLE_GROUPS.has(value as TargetMuscleGroup)) {
    return getMuscleGroupLabel(t, value as TargetMuscleGroup);
  }

  return value
    .replace(/_/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
