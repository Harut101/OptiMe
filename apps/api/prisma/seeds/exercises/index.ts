import { cardioExercises } from './cardio';
import { translationsFor } from './content';
import { coreExercises } from './core';
import { mobilityExercises } from './mobility';
import { strengthExercises } from './strength';
import type { SeedExercise } from './types';

export const exerciseCatalog: SeedExercise[] = [
  ...strengthExercises,
  ...coreExercises,
  ...mobilityExercises,
  ...cardioExercises
].map((item, index) => ({
  ...item,
  sortOrder: index + 1,
  isActive: true,
  translations: translationsFor(item),
  media: []
}));
