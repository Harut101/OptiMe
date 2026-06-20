import type { PrismaClient } from '@prisma/client';
import { EXERCISE_CATEGORIES, EXERCISE_CONTRAINDICATION_TAGS, EXERCISE_EQUIPMENT, EXERCISE_MEDIA_TYPES, MOVEMENT_PATTERNS, SUPPORTED_LOCALES, TARGET_MUSCLE_GROUPS, TRAINING_LEVELS } from '@optime/shared-types';
import type { SeedExercise } from './types';

const BROAD_LEGACY_MUSCLES = new Set(['ARMS', 'BACK', 'CORE', 'LEGS']);
const INTENTIONAL_FULL_BODY = new Set(['walking']);
const FORBIDDEN_MEDIA_HOSTS = ['example.com', 'placeholder.com', 'placehold.co', 'via.placeholder.com'];

export function validateExerciseCatalog(catalog: SeedExercise[]) {
  const errors: string[] = [];
  const slugs = new Set<string>();
  const sortOrders = new Set<number>();
  for (const exercise of catalog) {
    const fail = (field: string, reason: string) => errors.push(`${exercise.slug || '<missing-slug>'}: ${field}: ${reason}`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(exercise.slug)) fail('slug', 'must be non-empty and URL-safe');
    if (slugs.has(exercise.slug)) fail('slug', 'duplicate');
    slugs.add(exercise.slug);
    if (!Number.isInteger(exercise.sortOrder) || exercise.sortOrder < 0 || sortOrders.has(exercise.sortOrder)) fail('sortOrder', 'must be unique and non-negative');
    sortOrders.add(exercise.sortOrder);
    if (!EXERCISE_CATEGORIES.includes(exercise.category)) fail('category', 'unsupported value');
    if (!MOVEMENT_PATTERNS.includes(exercise.movementPattern)) fail('movementPattern', 'unsupported value');
    if (!exercise.equipment.length || exercise.equipment.some((item) => !EXERCISE_EQUIPMENT.includes(item))) fail('equipment', 'must contain supported values');
    if (!exercise.targetMuscles.length) fail('targetMuscles', 'at least one specific target is required');
    if (exercise.targetMuscles.some((item) => !TARGET_MUSCLE_GROUPS.includes(item))) fail('targetMuscles', 'contains an unsupported muscle group');
    if (exercise.targetMuscles.some((item) => BROAD_LEGACY_MUSCLES.has(item))) fail('targetMuscles', 'broad legacy muscle groups are not allowed in new seeds');
    if (exercise.targetMuscles.includes('FULL_BODY') && !INTENTIONAL_FULL_BODY.has(exercise.slug)) fail('targetMuscles', 'FULL_BODY is not documented for this exercise');
    if (new Set(exercise.targetMuscles).size !== exercise.targetMuscles.length) fail('targetMuscles', 'duplicates are not allowed');
    if (new Set(exercise.secondaryMuscles).size !== exercise.secondaryMuscles.length) fail('secondaryMuscles', 'duplicates are not allowed');
    if (exercise.secondaryMuscles.some((item) => !TARGET_MUSCLE_GROUPS.includes(item))) fail('secondaryMuscles', 'contains an unsupported muscle group');
    if (exercise.secondaryMuscles.some((item) => exercise.targetMuscles.includes(item))) fail('secondaryMuscles', 'cannot duplicate a target muscle');
    if (!exercise.trainingLevels.length) fail('trainingLevels', 'at least one level is required');
    if (exercise.trainingLevels.some((item) => !TRAINING_LEVELS.includes(item))) fail('trainingLevels', 'contains an unsupported level');
    if (exercise.contraindicationTags.some((item) => !EXERCISE_CONTRAINDICATION_TAGS.includes(item))) fail('contraindicationTags', 'unsupported value');

    const translationLocales = new Set(exercise.translations.map((item) => item.locale));
    for (const locale of SUPPORTED_LOCALES) if (!translationLocales.has(locale)) fail('translations', `missing ${locale}`);
    if (translationLocales.size !== exercise.translations.length) fail('translations', 'duplicate locale');
    for (const translation of exercise.translations) {
      if (!translation.name.trim()) fail(`translations.${translation.locale}.name`, 'must not be empty');
      for (const field of ['instructions', 'coachingCues', 'safetyNotes'] as const) {
        if (!translation[field].length || translation[field].some((item) => !item.trim())) fail(`translations.${translation.locale}.${field}`, 'must contain non-empty ordered entries');
      }
      if (/[_]/.test(translation.name) || /^(exercise|todo|placeholder)([-_ ]|$)/i.test(translation.name)) {
        fail(`translations.${translation.locale}.name`, 'must be a user-facing localized name, not a seed placeholder');
      }
    }

    const primaryCount = exercise.media.filter((item) => item.isActive && item.isPrimary).length;
    if (primaryCount > 1) fail('media', 'only one active primary item is allowed');
    for (const media of exercise.media) {
      const identity = media.seedKey ?? media.url;
      if (!media.seedKey.trim()) fail(`media.${identity}.seedKey`, 'stable seed identity is required');
      if (!EXERCISE_MEDIA_TYPES.includes(media.type)) fail(`media.${identity}.type`, 'unsupported value');
      if (!media.url.trim()) fail(`media.${identity}.url`, 'must not be empty');
      try {
        const host = new URL(media.url).hostname.toLowerCase();
        if (FORBIDDEN_MEDIA_HOSTS.some((item) => host === item || host.endsWith(`.${item}`))) fail(`media.${identity}.url`, 'placeholder domains are forbidden');
      } catch {
        fail(`media.${identity}.url`, 'must be a valid URL');
      }
      if (media.sortOrder < 0) fail(`media.${identity}.sortOrder`, 'must be non-negative');
      if ((media.width == null) !== (media.height == null) || (media.width != null && (media.width <= 0 || media.height! <= 0))) fail(`media.${identity}.dimensions`, 'width and height must both be positive or absent');
      const locales = new Set(media.translations.map((item) => item.locale));
      if (!locales.has('en-US')) fail(`media.${identity}.translations`, 'English alt text is required');
      if (locales.size !== media.translations.length) fail(`media.${identity}.translations`, 'duplicate locale');
    }
  }
  if (catalog.length < 35 || catalog.length > 50) errors.push(`catalog: expected 35-50 exercises, received ${catalog.length}`);
  if (errors.length) throw new Error(`Exercise catalog validation failed:\n${errors.join('\n')}`);
  return { exerciseCount: catalog.length, translationCount: catalog.reduce((sum, item) => sum + item.translations.length, 0), mediaCount: catalog.reduce((sum, item) => sum + item.media.length, 0) };
}

export async function validateSeededExerciseDatabase(prisma: PrismaClient, expectedCount: number) {
  const exercises = await prisma.exercise.findMany({ include: { translations: true, media: { include: { translations: true } } } });
  if (exercises.length < expectedCount) throw new Error(`Database contains ${exercises.length} exercises; expected at least ${expectedCount}.`);
  for (const exercise of exercises.filter((item) => item.sortOrder <= expectedCount)) {
    if (exercise.translations.length !== SUPPORTED_LOCALES.length) throw new Error(`${exercise.slug}: database translation count is ${exercise.translations.length}.`);
  }
  return exercises.length;
}
