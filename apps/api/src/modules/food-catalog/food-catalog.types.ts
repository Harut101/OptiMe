import type {
  DietType,
  FoodCatalogCategory,
  FoodPreparationLevel,
  FoodRestrictionTag
} from '@prisma/client';
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
  preparationLevel: FoodPreparationLevel;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number | null;
  dietTypes: DietType[];
  restrictionTags: FoodRestrictionTag[];
  aliases: string[];
}

export const FOOD_CATALOG_SELECTION_ROLES = [
  'BREAKFAST_BASE',
  'MAIN_PROTEIN',
  'CARBOHYDRATE',
  'VEGETABLE',
  'FRUIT',
  'FAT',
  'DAIRY_OR_ALTERNATIVE'
] as const;

export type FoodCatalogSelectionRole = (typeof FOOD_CATALOG_SELECTION_ROLES)[number];

export interface SelectDailyFoodCatalogInput extends Omit<ListFoodCatalogCandidatesInput, 'limit'> {
  planLocalDate: string;
  preferredFoods?: string[];
  maxPerRole?: number;
}

export interface DailyFoodCatalogSelection {
  candidates: FoodCatalogCandidate[];
  byRole: Record<FoodCatalogSelectionRole, FoodCatalogCandidate[]>;
}

export interface FoodCatalogNutrition {
  caloriesKcal: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams: number | null;
}
