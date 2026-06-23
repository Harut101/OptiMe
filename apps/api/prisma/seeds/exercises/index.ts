import { loadApprovedExerciseExpansion } from './approved-expansion';
import { cardioExercises } from './cardio';
import { translationsFor } from './content';
import { coreExercises } from './core';
import { mobilityExercises } from './mobility';
import { strengthExercises } from './strength';
import type { SeedExercise } from './types';

const baseExerciseInputs = [
  ...strengthExercises,
  ...coreExercises,
  ...mobilityExercises,
  ...cardioExercises
];

export const baseExerciseCatalog: SeedExercise[] = baseExerciseInputs.map((item, index) => ({
  ...item,
  sortOrder: index + 1,
  isActive: true,
  translations: translationsFor(item),
  media: []
}));

const approvedExpansionInputs = loadApprovedExerciseExpansion(new Set(baseExerciseCatalog.map((item) => item.slug)));

export const exerciseCatalog: SeedExercise[] = [
  ...baseExerciseInputs,
  ...approvedExpansionInputs
].map((item, index) => ({
  ...item,
  sortOrder: index + 1,
  isActive: true,
  translations: translationsFor(item),
  media: []
}));
