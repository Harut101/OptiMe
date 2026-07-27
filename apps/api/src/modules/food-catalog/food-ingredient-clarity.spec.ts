import {
  FoodCatalogCategory,
  FoodPreparationLevel
} from '@prisma/client';

import type { FoodCatalogCandidate } from './food-catalog.types';
import {
  createFoodIngredientClarity,
  refreshFoodIngredientClarity
} from './food-ingredient-clarity';

describe('createFoodIngredientClarity', () => {
  it('marks olive oil as a measured cooking ingredient included in totals', () => {
    const result = createFoodIngredientClarity({
      candidate: createCandidate({
        slug: 'olive-oil',
        name: 'Olive oil',
        category: FoodCatalogCategory.FAT
      }),
      selectionRole: 'FAT',
      locale: 'en-US'
    });

    expect(result).toEqual(
      expect.objectContaining({
        role: 'COOKING_FAT',
        measurementState: 'AS_LISTED'
      })
    );
    expect(result.usage).toContain('during cooking or as dressing');
    expect(result.usage).toContain('included in the nutrition totals');
  });

  it('does not classify every catalog fat candidate as cooking fat', () => {
    const result = createFoodIngredientClarity({
      candidate: createCandidate({
        slug: 'avocado',
        name: 'Avocado',
        category: FoodCatalogCategory.FAT
      }),
      selectionRole: 'FAT',
      locale: 'en-US'
    });

    expect(result.role).toBe('SIDE');
  });

  it('derives cooked measurement state from the catalog identity', () => {
    const result = createFoodIngredientClarity({
      candidate: createCandidate({
        slug: 'salmon-cooked',
        name: 'Cooked salmon',
        category: FoodCatalogCategory.PROTEIN
      }),
      selectionRole: 'MAIN_PROTEIN',
      locale: 'en-US'
    });

    expect(result.role).toBe('MAIN');
    expect(result.measurementState).toBe('COOKED');
    expect(result.preparation).toBe('Measure after cooking.');
  });

  it('uses a conservative state when the catalog identity is ambiguous', () => {
    const result = createFoodIngredientClarity({
      candidate: createCandidate({
        slug: 'mixed-berries',
        name: 'Mixed berries',
        category: FoodCatalogCategory.FRUIT
      }),
      selectionRole: 'FRUIT',
      locale: 'en-US'
    });

    expect(result.measurementState).toBe('AS_LISTED');
    expect(result.preparation).toBe(
      'Measure in the form named above.'
    );
  });

  it('refreshes semantics when a side is swapped for cooking oil', () => {
    const result = refreshFoodIngredientClarity({
      candidate: createCandidate({
        slug: 'olive-oil',
        name: 'Olive oil',
        category: FoodCatalogCategory.FAT
      }),
      existingRole: 'SIDE',
      locale: 'en-US'
    });

    expect(result.role).toBe('COOKING_FAT');
    expect(result.usage).toContain('during cooking or as dressing');
  });
});

function createCandidate(
  overrides: Pick<
    FoodCatalogCandidate,
    'slug' | 'name' | 'category'
  >
): FoodCatalogCandidate {
  return {
    id: overrides.slug,
    ...overrides,
    preparationLevel: FoodPreparationLevel.QUICK_ASSEMBLY,
    caloriesPer100g: 100,
    proteinPer100g: 2,
    carbsPer100g: 10,
    fatPer100g: 5,
    fiberPer100g: null,
    dietTypes: [],
    restrictionTags: [],
    aliases: []
  };
}
