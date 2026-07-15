import { FoodCatalogCoverageService } from '../src/modules/food-catalog/food-catalog-coverage.service';
import { FoodCatalogService } from '../src/modules/food-catalog/food-catalog.service';
import { cleanupDatabase } from './helpers/cleanup';
import { seedFoodCatalog } from '../prisma/seeds/foods/seed';
import { createTestApp, TestApp } from './helpers/test-app';

describe('Food catalog coverage audit', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
    await seedFoodCatalog(ctx.prisma);
  });

  beforeEach(async () => {
    await cleanupDatabase(ctx.prisma);
  });

  afterAll(async () => {
    await cleanupDatabase(ctx.prisma);
    await ctx.app.close();
  });

  it('reports direct diet and common restriction scenarios with all required roles', async () => {
    const service = ctx.app.get(FoodCatalogCoverageService);
    const report = await service.audit('en-US');

    expect(report.locale).toBe('en-US');
    expect(report.scenarios).toHaveLength(13);
    expect(report.scenarios).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'OMNIVORE', status: 'READY', missingRoles: [] }),
      expect.objectContaining({ id: 'VEGETARIAN', status: 'READY', missingRoles: [] }),
      expect.objectContaining({ id: 'VEGAN', status: 'READY', missingRoles: [] }),
      expect.objectContaining({ id: 'PESCATARIAN', status: 'READY', missingRoles: [] }),
      expect.objectContaining({ id: 'MEDITERRANEAN', status: 'READY', missingRoles: [] }),
      expect.objectContaining({ id: 'LOW_CARB', status: 'READY', missingRoles: [] }),
      expect.objectContaining({ id: 'KETO', status: 'READY', missingRoles: [] }),
      expect.objectContaining({
        id: 'OMNIVORE_DAIRY_AND_FISH_FREE',
        status: 'READY',
        missingRoles: [],
        restrictions: { allergies: ['milk', 'fish'] }
      }),
      expect.objectContaining({
        id: 'VEGETARIAN_EGG_AND_SOY_FREE',
        status: 'READY',
        missingRoles: [],
        restrictions: { allergies: ['egg', 'soy'] }
      }),
      expect.objectContaining({
        id: 'VEGAN_SOY_AND_TREE_NUT_FREE',
        status: 'READY',
        missingRoles: [],
        restrictions: { allergies: ['soy', 'tree nuts'] }
      }),
      expect.objectContaining({
        id: 'GLUTEN_FREE_OMNIVORE',
        status: 'READY',
        missingRoles: [],
        restrictions: { allergies: ['gluten'] }
      }),
      expect.objectContaining({
        id: 'LOW_CARB_DAIRY_FREE',
        status: 'READY',
        missingRoles: [],
        restrictions: { allergies: ['milk'] }
      }),
      expect.objectContaining({
        id: 'KETO_DAIRY_AND_TREE_NUT_FREE',
        status: 'READY',
        missingRoles: [],
        restrictions: { allergies: ['milk', 'tree nuts'] }
      })
    ]));
    expect(report.scenarios.every((scenario) => scenario.activeCandidateCount > 0)).toBe(true);
  });

  it('filters high-carbohydrate catalog foods for keto and low-carb selection', async () => {
    const service = ctx.app.get(FoodCatalogService);
    const lowCarb = await service.listAllowedCandidates({ locale: 'en-US', dietType: 'LOW_CARB' });
    const keto = await service.listAllowedCandidates({ locale: 'en-US', dietType: 'KETO' });

    expect(lowCarb.some((candidate) => candidate.slug === 'rolled-oats')).toBe(false);
    expect(keto.some((candidate) => candidate.slug === 'rolled-oats')).toBe(false);
    expect(keto.some((candidate) => candidate.slug === 'chicken-breast-cooked')).toBe(true);
    expect(keto.every((candidate) => candidate.carbsPer100g <= 10)).toBe(true);
    expect(lowCarb.every((candidate) => candidate.carbsPer100g <= 15)).toBe(true);
  });

  it('uses the same restriction filters as planning for coverage bundles', async () => {
    const service = ctx.app.get(FoodCatalogService);
    const vegan = await service.listAllowedCandidates({
      locale: 'en-US',
      dietType: 'VEGAN',
      restrictions: { allergies: ['soy', 'tree nuts'] }
    });
    const glutenFree = await service.listAllowedCandidates({
      locale: 'en-US',
      dietType: 'OMNIVORE',
      restrictions: { allergies: ['gluten'] }
    });

    expect(vegan.map((candidate) => candidate.slug)).not.toEqual(expect.arrayContaining([
      'firm-tofu',
      'tempeh',
      'edamame-cooked',
      'almonds'
    ]));
    expect(glutenFree.map((candidate) => candidate.slug)).not.toEqual(expect.arrayContaining([
      'whole-grain-bread',
      'couscous-cooked'
    ]));
    expect(vegan.some((candidate) => candidate.slug === 'lentils-cooked')).toBe(true);
    expect(glutenFree.some((candidate) => candidate.slug === 'brown-rice-cooked')).toBe(true);
  });
});
