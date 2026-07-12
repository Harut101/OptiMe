import { FoodCatalogSource, PreferredLocale } from '@prisma/client';

import { prepareUsdaFdcImport } from '../src/modules/food-catalog/usda-fdc-import';
import { importFoods } from '../scripts/food-catalog/import-usda-fdc';
import { cleanupDatabase } from './helpers/cleanup';
import { createTestApp, TestApp } from './helpers/test-app';

const payload = {
  foods: [
    {
      fdcId: 123456,
      description: 'Example foundation food',
      dataType: 'Foundation',
      foodCategory: { description: 'Vegetables and Vegetable Products' },
      foodNutrients: [
        { nutrient: { id: 1008, name: 'Energy', unitName: 'kcal' }, amount: 44 },
        { nutrient: { id: 1003, name: 'Protein', unitName: 'g' }, amount: 2.1 },
        { nutrient: { id: 1005, name: 'Carbohydrate, by difference', unitName: 'g' }, amount: 8.4 },
        { nutrient: { id: 1004, name: 'Total lipid (fat)', unitName: 'g' }, amount: 0.5 },
        { nutrient: { id: 1079, name: 'Fiber, total dietary', unitName: 'g' }, amount: 3.2 }
      ]
    },
    {
      fdcId: 123457,
      description: 'Missing macro example',
      dataType: 'Foundation',
      foodNutrients: [{ nutrient: { id: 1008, name: 'Energy', unitName: 'kcal' }, amount: 60 }]
    },
    {
      fdcId: 123458,
      description: 'Legacy food outside the default import scope',
      dataType: 'SR Legacy',
      foodNutrients: []
    }
  ]
};

describe('USDA FoodData Central import foundation', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await cleanupDatabase(ctx.prisma);
    await ctx.prisma.foodCatalogItem.deleteMany({
      where: { source: FoodCatalogSource.USDA_FDC }
    });
  });

  afterAll(async () => {
    if (ctx) {
      await cleanupDatabase(ctx.prisma);
      await ctx.prisma.foodCatalogItem.deleteMany({
        where: { source: FoodCatalogSource.USDA_FDC }
      });
      await ctx.app.close();
    }
  });

  it('accepts complete Foundation records and rejects incomplete or out-of-scope records', () => {
    const result = prepareUsdaFdcImport(payload);

    expect(result.foods).toEqual([
      expect.objectContaining({
        sourceFoodId: '123456',
        slug: 'usda-fdc-123456',
        name: 'Example foundation food',
        category: 'VEGETABLE',
        caloriesPer100g: 44,
        proteinPer100g: 2.1,
        carbsPer100g: 8.4,
        fatPer100g: 0.5,
        fiberPer100g: 3.2,
        dietTypes: []
      })
    ]);
    expect(result.skipped).toEqual(expect.arrayContaining([
      { sourceFoodId: '123457', reason: 'missing_required_nutrients' },
      { sourceFoodId: '123458', reason: 'data_type_not_allowed' }
    ]));
  });

  it('upserts imported foods as inactive and preserves reviewed active entries', async () => {
    const [food] = prepareUsdaFdcImport(payload).foods;
    const firstImport = await importFoods(ctx.prisma, [food]);

    expect(firstImport).toEqual({ createdOrUpdated: 1, skippedReviewed: 0 });
    const imported = await ctx.prisma.foodCatalogItem.findUniqueOrThrow({
      where: {
        source_sourceFoodId: {
          source: FoodCatalogSource.USDA_FDC,
          sourceFoodId: '123456'
        }
      },
      include: { translations: true }
    });
    expect(imported.isActive).toBe(false);
    expect(imported.dietTypes).toEqual([]);
    expect(imported.restrictionTags).toEqual([]);
    expect(imported.translations).toContainEqual(expect.objectContaining({
      locale: PreferredLocale.EN_US,
      name: 'Example foundation food'
    }));

    await ctx.prisma.foodCatalogItem.update({
      where: { id: imported.id },
      data: { isActive: true }
    });
    const repeatImport = await importFoods(ctx.prisma, [food]);
    expect(repeatImport).toEqual({ createdOrUpdated: 0, skippedReviewed: 1 });
  });
});
