import type { DietType, FoodCatalogCategory } from '@prisma/client';
import type { SupportedLocale } from '@optime/shared-types';

export interface FoodCatalogRestrictions {
  allergies?: string[];
  excludedFoods?: string[];
  dislikedFoods?: string[];
}

export interface ListFoodCatalogCandidatesInput {
  locale: SupportedLocale;
  dietType?: DietType | null;
  restrictions?: FoodCatalogRestrictions;
  limit?: number;
}

export interface FoodCatalogCandidate {
  id: string;
  slug: string;
  name: string;
  category: FoodCatalogCategory;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number | null;
  dietTypes: DietType[];
}

export interface FoodCatalogNutrition {
  caloriesKcal: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams: number | null;
}
