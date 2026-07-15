import { PrismaService } from '../../src/prisma/prisma.service';
import { FoodCatalogCoverageService } from '../../src/modules/food-catalog/food-catalog-coverage.service';
import { FoodCatalogService } from '../../src/modules/food-catalog/food-catalog.service';
import type { SupportedLocale } from '@optime/shared-types';

const locale = readLocale(process.argv.slice(2));
const prisma = new PrismaService();
const foodCatalog = new FoodCatalogService(prisma);
const coverage = new FoodCatalogCoverageService(foodCatalog);

void coverage.audit(locale)
  .then((report) => {
    console.log(`Food catalog coverage (${report.locale})`);
    for (const scenario of report.scenarios) {
      console.log(`${scenario.id}: ${scenario.status}; active=${scenario.activeCandidateCount}`);
      const restrictions = [
        ...(scenario.restrictions.allergies ?? []).map((item) => `allergy:${item}`),
        ...(scenario.restrictions.excludedFoods ?? []).map((item) => `excluded:${item}`),
        ...(scenario.restrictions.dislikedFoods ?? []).map((item) => `disliked:${item}`)
      ];
      if (restrictions.length) console.log(`  restrictions=${restrictions.join(', ')}`);
      console.log(`  roles=${Object.entries(scenario.roleCounts).map(([role, count]) => `${role}:${count}`).join(', ')}`);
      if (scenario.missingRoles.length) console.log(`  missing=${scenario.missingRoles.join(', ')}`);
      if (scenario.limitedRoles.length) console.log(`  limited=${scenario.limitedRoles.join(', ')}`);
    }
  })
  .finally(async () => prisma.$disconnect());

function readLocale(args: string[]): SupportedLocale {
  const localeIndex = args.indexOf('--locale');
  const value = localeIndex === -1 ? 'en-US' : args[localeIndex + 1];
  if (value === 'en-US' || value === 'ru-RU' || value === 'fr-FR' || value === 'zh-CN') return value;
  throw new Error('Use --locale en-US, ru-RU, fr-FR, or zh-CN.');
}
