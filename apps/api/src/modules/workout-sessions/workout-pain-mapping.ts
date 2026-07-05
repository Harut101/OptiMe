import { TargetMuscleGroup } from '@prisma/client';

export const WORKOUT_PAIN_AREAS = [
  'CORE_ABS',
  'LOWER_BACK',
  'SHOULDERS',
  'CHEST',
  'UPPER_BACK_LATS',
  'BICEPS',
  'TRICEPS',
  'GLUTES',
  'HAMSTRINGS',
  'QUADRICEPS',
  'CALVES',
  'KNEES',
  'WRISTS_FOREARMS',
  'OTHER'
] as const;

export type WorkoutPainArea = (typeof WORKOUT_PAIN_AREAS)[number];

export const PAIN_AREA_TO_MUSCLES: Record<WorkoutPainArea, TargetMuscleGroup[]> = {
  CORE_ABS: [TargetMuscleGroup.ABS, TargetMuscleGroup.OBLIQUES, TargetMuscleGroup.CORE],
  LOWER_BACK: [TargetMuscleGroup.LOWER_BACK, TargetMuscleGroup.BACK],
  SHOULDERS: [TargetMuscleGroup.SHOULDERS],
  CHEST: [TargetMuscleGroup.CHEST],
  UPPER_BACK_LATS: [TargetMuscleGroup.TRAPS, TargetMuscleGroup.LATS, TargetMuscleGroup.BACK],
  BICEPS: [TargetMuscleGroup.BICEPS, TargetMuscleGroup.ARMS],
  TRICEPS: [TargetMuscleGroup.TRICEPS, TargetMuscleGroup.ARMS],
  GLUTES: [TargetMuscleGroup.GLUTES],
  HAMSTRINGS: [TargetMuscleGroup.HAMSTRINGS, TargetMuscleGroup.LEGS],
  QUADRICEPS: [TargetMuscleGroup.QUADRICEPS, TargetMuscleGroup.LEGS],
  CALVES: [TargetMuscleGroup.CALVES, TargetMuscleGroup.LEGS],
  KNEES: [TargetMuscleGroup.QUADRICEPS, TargetMuscleGroup.HAMSTRINGS, TargetMuscleGroup.LEGS],
  WRISTS_FOREARMS: [TargetMuscleGroup.FOREARMS, TargetMuscleGroup.ARMS],
  OTHER: []
};

export function isWorkoutPainArea(value: string): value is WorkoutPainArea {
  return (WORKOUT_PAIN_AREAS as readonly string[]).includes(value);
}

export function normalizePainAreas(values: string[] = []) {
  const seen = new Set<WorkoutPainArea>();
  const result: WorkoutPainArea[] = [];

  for (const value of values) {
    const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    if (!isWorkoutPainArea(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

export function mapPainAreasToMuscles(painAreas: string[]) {
  return [...new Set(normalizePainAreas(painAreas).flatMap((area) => PAIN_AREA_TO_MUSCLES[area]))];
}
