import { PrismaClient, PreferredLocale } from '@prisma/client';
import type { SupportedLocale } from '@optime/shared-types';
import { exerciseCatalog } from './index';
import { validateExerciseCatalog, validateSeededExerciseDatabase } from './validate-catalog';

const LOCALES: Record<SupportedLocale, PreferredLocale> = { 'en-US': PreferredLocale.EN_US, 'ru-RU': PreferredLocale.RU_RU, 'fr-FR': PreferredLocale.FR_FR, 'zh-CN': PreferredLocale.ZH_CN };

export async function seedExerciseCatalog(prisma: PrismaClient) {
  const result = validateExerciseCatalog(exerciseCatalog);
  for (const definition of exerciseCatalog) {
    const exercise = await prisma.exercise.upsert({
      where: { slug: definition.slug },
      create: {
        slug: definition.slug, category: definition.category, movementPattern: definition.movementPattern,
        equipment: definition.equipment, targetMuscles: definition.targetMuscles, secondaryMuscles: definition.secondaryMuscles,
        trainingLevels: definition.trainingLevels, contraindicationTags: definition.contraindicationTags,
        isActive: definition.isActive, sortOrder: definition.sortOrder
      },
      update: {
        category: definition.category, movementPattern: definition.movementPattern,
        equipment: definition.equipment, targetMuscles: definition.targetMuscles, secondaryMuscles: definition.secondaryMuscles,
        trainingLevels: definition.trainingLevels, contraindicationTags: definition.contraindicationTags,
        isActive: definition.isActive, sortOrder: definition.sortOrder
      }
    });
    for (const translation of definition.translations) {
      const data = { name: translation.name, description: translation.description, instructions: translation.instructions, coachingCues: translation.coachingCues, safetyNotes: translation.safetyNotes };
      await prisma.exerciseTranslation.upsert({
        where: { exerciseId_locale: { exerciseId: exercise.id, locale: LOCALES[translation.locale] } },
        create: { exerciseId: exercise.id, locale: LOCALES[translation.locale], ...data },
        update: data
      });
    }
    for (const mediaDefinition of definition.media) {
      const mediaData = {
        exerciseId: exercise.id,
        type: mediaDefinition.type,
        url: mediaDefinition.url,
        thumbnailUrl: mediaDefinition.thumbnailUrl ?? null,
        width: mediaDefinition.width ?? null,
        height: mediaDefinition.height ?? null,
        sortOrder: mediaDefinition.sortOrder,
        isPrimary: mediaDefinition.isPrimary,
        isActive: mediaDefinition.isActive,
        source: mediaDefinition.source ?? null,
        license: mediaDefinition.license ?? null,
        attribution: mediaDefinition.attribution ?? null
      };
      const media = await prisma.exerciseMedia.upsert({
        where: { seedKey: mediaDefinition.seedKey },
        create: { seedKey: mediaDefinition.seedKey, ...mediaData },
        update: mediaData
      });
      for (const translation of mediaDefinition.translations) {
        const data = { altText: translation.altText, caption: translation.caption ?? null };
        await prisma.exerciseMediaTranslation.upsert({
          where: { exerciseMediaId_locale: { exerciseMediaId: media.id, locale: LOCALES[translation.locale] } },
          create: { exerciseMediaId: media.id, locale: LOCALES[translation.locale], ...data },
          update: data
        });
      }
    }
  }
  await validateSeededExerciseDatabase(prisma, result.exerciseCount);
  return result;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await seedExerciseCatalog(prisma);
    console.log(`Exercise seed complete: ${result.exerciseCount} exercises, ${result.translationCount} translations, ${result.mediaCount} media.`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) void main().catch((error) => { console.error(error); process.exitCode = 1; });
