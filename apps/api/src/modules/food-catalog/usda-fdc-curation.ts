import {
  DietType,
  FoodCatalogCategory,
  FoodPreparationLevel,
  FoodCatalogSource,
  FoodRestrictionTag,
  PreferredLocale,
  PrismaClient
} from '@prisma/client';
import { z } from 'zod';

const supportedLocales = ['en-US', 'ru-RU', 'fr-FR', 'zh-CN'] as const;

const translationSchema = z.object({
  name: z.string().trim().min(1).max(160),
  aliases: z.array(z.string().trim().min(1).max(120)).max(24).default([])
});

const foodCurationSchema = z.object({
  sourceFoodId: z.string().trim().regex(/^\d+$/),
  category: z.nativeEnum(FoodCatalogCategory),
  preparationLevel: z.nativeEnum(FoodPreparationLevel).default(FoodPreparationLevel.COOK_REQUIRED),
  dietTypes: z.array(z.nativeEnum(DietType)).min(1).max(8),
  restrictionTags: z.array(z.nativeEnum(FoodRestrictionTag)).max(10),
  translations: z.object({
    'en-US': translationSchema,
    'ru-RU': translationSchema,
    'fr-FR': translationSchema,
    'zh-CN': translationSchema
  })
});

const manifestSchema = z.object({
  version: z.literal(1),
  foods: z.array(foodCurationSchema).min(1).max(500)
});

export type UsdaFdcCurationManifest = z.infer<typeof manifestSchema>;
export type UsdaFdcCurationFood = z.infer<typeof foodCurationSchema>;

const localeMap: Record<(typeof supportedLocales)[number], PreferredLocale> = {
  'en-US': PreferredLocale.EN_US,
  'ru-RU': PreferredLocale.RU_RU,
  'fr-FR': PreferredLocale.FR_FR,
  'zh-CN': PreferredLocale.ZH_CN
};

export function parseUsdaFdcCurationManifest(payload: unknown): UsdaFdcCurationManifest {
  const manifest = manifestSchema.parse(payload);
  const sourceIds = new Set<string>();
  for (const food of manifest.foods) {
    if (sourceIds.has(food.sourceFoodId)) {
      throw new Error(`USDA curation manifest has duplicate sourceFoodId: ${food.sourceFoodId}`);
    }
    sourceIds.add(food.sourceFoodId);
  }
  return manifest;
}

export async function applyUsdaFdcCuration(
  prisma: PrismaClient,
  manifest: UsdaFdcCurationManifest
) {
  const records = await prisma.foodCatalogItem.findMany({
    where: {
      source: FoodCatalogSource.USDA_FDC,
      sourceFoodId: { in: manifest.foods.map((food) => food.sourceFoodId) }
    },
    select: { id: true, sourceFoodId: true }
  });
  const recordsBySourceId = new Map(records.map((record) => [record.sourceFoodId, record]));
  const missing = manifest.foods
    .map((food) => food.sourceFoodId)
    .filter((sourceFoodId) => !recordsBySourceId.has(sourceFoodId));
  if (missing.length) {
    throw new Error(`USDA curation references missing imported foods: ${missing.join(', ')}`);
  }

  for (const food of manifest.foods) {
    const record = recordsBySourceId.get(food.sourceFoodId);
    if (!record) continue;

    await prisma.foodCatalogItem.update({
      where: { id: record.id },
      data: {
        category: food.category,
        preparationLevel: food.preparationLevel,
        dietTypes: food.dietTypes,
        restrictionTags: food.restrictionTags,
        isActive: true
      }
    });

    for (const locale of supportedLocales) {
      const translation = food.translations[locale];
      await prisma.foodCatalogTranslation.upsert({
        where: {
          foodCatalogItemId_locale: {
            foodCatalogItemId: record.id,
            locale: localeMap[locale]
          }
        },
        create: {
          foodCatalogItemId: record.id,
          locale: localeMap[locale],
          name: translation.name,
          aliases: translation.aliases
        },
        update: {
          name: translation.name,
          aliases: translation.aliases
        }
      });
    }
  }

  return { activated: manifest.foods.length };
}
