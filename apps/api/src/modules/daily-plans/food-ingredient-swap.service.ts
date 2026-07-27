import { Injectable } from '@nestjs/common';
import type { DietType } from '@prisma/client';
import type { FoodIngredient } from '@optime/shared-types';
import type { SupportedLocale } from '@optime/shared-types';

import { FoodCatalogService } from '../food-catalog/food-catalog.service';
import { refreshFoodIngredientClarity } from '../food-catalog/food-ingredient-clarity';

type FoodIngredientSwapInput = {
  ingredient: FoodIngredient;
  locale: SupportedLocale;
  dietType: DietType | null;
  restrictions: {
    allergies: string[];
    excludedFoods: string[];
    dislikedFoods: string[];
  };
};

@Injectable()
export class FoodIngredientSwapService {
  constructor(private readonly foodCatalog: FoodCatalogService) {}

  /**
   * Produces safe, catalog-backed alternatives without mutating the stored
   * plan. Applying a choice is a later explicit action with full validation.
   */
  async getSuggestions(input: FoodIngredientSwapInput) {
    const originalSlug = input.ingredient.catalogFoodSlug;
    if (!originalSlug) return [];

    const original = await this.foodCatalog.getBySlug(originalSlug, input.locale);
    const candidates = await this.foodCatalog.listAllowedCandidates({
      locale: input.locale,
      dietType: input.dietType,
      restrictions: input.restrictions,
      limit: 160
    });

    return candidates
      .filter((candidate) => candidate.slug !== original.slug && candidate.category === original.category)
      .map((candidate) => {
        const suggestedQuantity = quantityForComparableCalories(
          input.ingredient.caloriesKcal,
          candidate.caloriesPer100g
        );
        const nutrition = this.foodCatalog.calculateNutrition(candidate, suggestedQuantity);
        const macroDistance =
          Math.abs(nutrition.proteinGrams - input.ingredient.proteinGrams) +
          Math.abs(nutrition.carbsGrams - input.ingredient.carbsGrams) +
          Math.abs(nutrition.fatGrams - input.ingredient.fatGrams);

        return {
          slug: candidate.slug,
          name: candidate.name,
          quantity: suggestedQuantity,
          unit: 'g' as const,
          caloriesKcal: nutrition.caloriesKcal,
          proteinGrams: nutrition.proteinGrams,
          carbsGrams: nutrition.carbsGrams,
          fatGrams: nutrition.fatGrams,
          preparationLevel: candidate.preparationLevel,
          ...refreshFoodIngredientClarity({
            candidate,
            existingRole: input.ingredient.role,
            locale: input.locale
          }),
          macroDistance
        };
      })
      .sort((left, right) => left.macroDistance - right.macroDistance || left.slug.localeCompare(right.slug))
      .slice(0, 3)
      .map(({ macroDistance: _macroDistance, ...suggestion }) => suggestion);
  }
}

function quantityForComparableCalories(caloriesKcal: number, caloriesPer100g: number) {
  if (!Number.isFinite(caloriesKcal) || caloriesKcal <= 0 || caloriesPer100g <= 0) return 100;
  return Math.min(500, Math.max(5, Math.round((caloriesKcal / caloriesPer100g * 100) / 5) * 5));
}
