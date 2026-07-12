import type { DietType, FoodCatalogCategory } from '@prisma/client';
import type { SupportedLocale } from '@optime/shared-types';

export interface SeedFoodTranslation {
  locale: SupportedLocale;
  name: string;
  aliases: string[];
}

export interface SeedFoodCatalogItem {
  slug: string;
  category: FoodCatalogCategory;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g?: number;
  dietTypes: DietType[];
  sortOrder: number;
  translations: SeedFoodTranslation[];
}
