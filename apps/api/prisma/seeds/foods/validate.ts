import type { SeedFoodCatalogItem } from './types';

const REQUIRED_LOCALES = ['en-US', 'ru-RU', 'fr-FR', 'zh-CN'] as const;

export function validateFoodCatalog(catalog: SeedFoodCatalogItem[]) {
  const slugs = new Set<string>();
  let translationCount = 0;

  for (const item of catalog) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug) || slugs.has(item.slug)) {
      throw new Error(`Food catalog has an invalid or duplicate slug: ${item.slug}`);
    }
    slugs.add(item.slug);

    for (const value of [
      item.caloriesPer100g,
      item.proteinPer100g,
      item.carbsPer100g,
      item.fatPer100g,
      item.fiberPer100g ?? 0
    ]) {
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`Food catalog has invalid nutrition values for: ${item.slug}`);
      }
    }

    const locales = new Set(item.translations.map((translation) => translation.locale));
    for (const locale of REQUIRED_LOCALES) {
      if (!locales.has(locale)) {
        throw new Error(`Food catalog is missing ${locale} translation for: ${item.slug}`);
      }
    }
    translationCount += item.translations.length;
  }

  return { itemCount: catalog.length, translationCount };
}

if (require.main === module) {
  // Keep validation usable before Prisma generation or a database is available.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { foodCatalog } = require('./catalog') as { foodCatalog: SeedFoodCatalogItem[] };
  const result = validateFoodCatalog(foodCatalog);
  console.log(`Food catalog validation passed: ${result.itemCount} foods, ${result.translationCount} translations.`);
}
