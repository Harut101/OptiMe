import {
  FoodCatalogCategory,
  FoodPreparationLevel
} from '@prisma/client';

import type { FoodCatalogService } from './food-catalog.service';
import { FoodCatalogSelectionService } from './food-catalog-selection.service';
import type { FoodCatalogCandidate } from './food-catalog.types';

describe('FoodCatalogSelectionService', () => {
  it('prefers a safe unused alternative over a recently repeated preferred food', async () => {
    const foodCatalog = createFoodCatalog([
      createCandidate('potato-cooked', 'Cooked potato'),
      createCandidate('rice-cooked', 'Cooked rice')
    ]);
    const service = new FoodCatalogSelectionService(
      foodCatalog as unknown as FoodCatalogService
    );

    const result = await service.selectForDailyPlan({
      locale: 'en-US',
      planLocalDate: '2026-07-28',
      preferredFoods: ['potato'],
      recentFoodUsage: [
        {
          catalogFoodSlug: 'potato-cooked',
          occurrenceCount: 4,
          daysUsed: 3,
          lastUsedLocalDate: '2026-07-27',
          daysSinceLastUse: 1
        }
      ],
      maxPerRole: 2
    });

    expect(result.byRole.CARBOHYDRATE.map((item) => item.slug)).toEqual([
      'rice-cooked',
      'potato-cooked'
    ]);
  });

  it('keeps explicitly available food ahead of the soft rotation penalty', async () => {
    const foodCatalog = createFoodCatalog([
      createCandidate('potato-cooked', 'Cooked potato'),
      createCandidate('rice-cooked', 'Cooked rice')
    ]);
    const service = new FoodCatalogSelectionService(
      foodCatalog as unknown as FoodCatalogService
    );

    const result = await service.selectForDailyPlan({
      locale: 'en-US',
      planLocalDate: '2026-07-28',
      availableFoodSlugs: ['potato-cooked'],
      recentFoodUsage: [
        {
          catalogFoodSlug: 'potato-cooked',
          occurrenceCount: 4,
          daysUsed: 3,
          lastUsedLocalDate: '2026-07-27',
          daysSinceLastUse: 1
        }
      ],
      maxPerRole: 2
    });

    expect(result.byRole.CARBOHYDRATE[0]?.slug).toBe(
      'potato-cooked'
    );
  });
});

function createFoodCatalog(candidates: FoodCatalogCandidate[]) {
  return {
    listAllowedCandidates: jest.fn().mockResolvedValue(candidates)
  };
}

function createCandidate(
  slug: string,
  name: string
): FoodCatalogCandidate {
  return {
    id: slug,
    slug,
    name,
    category: FoodCatalogCategory.GRAIN,
    preparationLevel: FoodPreparationLevel.READY_TO_EAT,
    caloriesPer100g: 100,
    proteinPer100g: 2,
    carbsPer100g: 20,
    fatPer100g: 1,
    fiberPer100g: 1,
    dietTypes: [],
    restrictionTags: [],
    aliases: []
  };
}
