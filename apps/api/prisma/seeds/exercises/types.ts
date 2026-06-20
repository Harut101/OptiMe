import type {
  ExerciseCategory,
  ExerciseContraindicationTag,
  ExerciseEquipment,
  ExerciseMediaType,
  MovementPattern,
  SupportedLocale,
  TargetMuscleGroup,
  TrainingLevel
} from '@optime/shared-types';

export type LocalizedNames = Record<SupportedLocale, string>;

export interface SeedTranslation {
  locale: SupportedLocale;
  name: string;
  description: string;
  instructions: string[];
  coachingCues: string[];
  safetyNotes: string[];
}

export interface SeedMediaTranslation {
  locale: SupportedLocale;
  altText: string;
  caption?: string;
}

export interface SeedMedia {
  seedKey: string;
  type: ExerciseMediaType;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  sortOrder: number;
  isPrimary: boolean;
  isActive: boolean;
  source?: string;
  license?: string;
  attribution?: string;
  translations: SeedMediaTranslation[];
}

export interface SeedExercise {
  slug: string;
  category: ExerciseCategory;
  movementPattern: MovementPattern;
  equipment: ExerciseEquipment[];
  targetMuscles: TargetMuscleGroup[];
  secondaryMuscles: TargetMuscleGroup[];
  trainingLevels: TrainingLevel[];
  contraindicationTags: ExerciseContraindicationTag[];
  isActive: true;
  sortOrder: number;
  translations: SeedTranslation[];
  media: SeedMedia[];
}

export type SeedExerciseInput = Omit<SeedExercise, 'sortOrder' | 'translations' | 'media' | 'isActive'> & {
  names: LocalizedNames;
};
