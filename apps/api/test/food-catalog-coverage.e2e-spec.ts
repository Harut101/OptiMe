import { FoodCatalogCoverageService } from '../src/modules/food-catalog/food-catalog-coverage.service';
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

  it('reports every supported direct diet scenario as ready with all required roles', async () => {
    const service = ctx.app.get(FoodCatalogCoverageService);
    const report = await service.audit('en-US');

    expect(report.locale).toBe('en-US');
    expect(report.scenarios).toHaveLength(4);
    expect(report.scenarios).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'OMNIVORE', status: 'READY', missingRoles: [] }),
      expect.objectContaining({ id: 'VEGETARIAN', status: 'READY', missingRoles: [] }),
      expect.objectContaining({ id: 'VEGAN', status: 'READY', missingRoles: [] }),
      expect.objectContaining({ id: 'PESCATARIAN', status: 'READY', missingRoles: [] })
    ]));
    expect(report.scenarios.every((scenario) => scenario.activeCandidateCount > 0)).toBe(true);
  });
});
