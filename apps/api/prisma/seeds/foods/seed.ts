import { FoodCatalogSource, PreferredLocale, PrismaClient } from '@prisma/client';
import type { SupportedLocale } from '@optime/shared-types';

import { foodCatalog } from './catalog';
import { validateFoodCatalog } from './validate';

const LOCALES: Record<SupportedLocale, PreferredLocale> = {
  'en-US': PreferredLocale.EN_US,
  'ru-RU': PreferredLocale.RU_RU,
  'fr-FR': PreferredLocale.FR_FR,
  'zh-CN': PreferredLocale.ZH_CN
};

export async function seedFoodCatalog(prisma: PrismaClient) {
  const validation = validateFoodCatalog(foodCatalog);

  for (const definition of foodCatalog) {
    const food = await prisma.foodCatalogItem.upsert({
      where: { slug: definition.slug },
      create: {
        slug: definition.slug,
        source: FoodCatalogSource.CURATED,
        category: definition.category,
        caloriesPer100g: definition.caloriesPer100g,
        proteinPer100g: definition.proteinPer100g,
        carbsPer100g: definition.carbsPer100g,
        fatPer100g: definition.fatPer100g,
        fiberPer100g: definition.fiberPer100g ?? null,
        dietTypes: definition.dietTypes,
        restrictionTags: definition.restrictionTags ?? [],
        isActive: true,
        sortOrder: definition.sortOrder
      },
      update: {
        category: definition.category,
        caloriesPer100g: definition.caloriesPer100g,
        proteinPer100g: definition.proteinPer100g,
        carbsPer100g: definition.carbsPer100g,
        fatPer100g: definition.fatPer100g,
        fiberPer100g: definition.fiberPer100g ?? null,
        dietTypes: definition.dietTypes,
        restrictionTags: definition.restrictionTags ?? [],
        isActive: true,
        sortOrder: definition.sortOrder
      }
    });

    for (const translation of definition.translations) {
      const data = { name: translation.name, aliases: translation.aliases };
      await prisma.foodCatalogTranslation.upsert({
        where: {
          foodCatalogItemId_locale: {
            foodCatalogItemId: food.id,
            locale: LOCALES[translation.locale]
          }
        },
        create: {
          foodCatalogItemId: food.id,
          locale: LOCALES[translation.locale],
          ...data
        },
        update: data
      });
    }
  }

  return validation;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await seedFoodCatalog(prisma);
    console.log(`Food catalog seed complete: ${result.itemCount} foods, ${result.translationCount} translations.`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
