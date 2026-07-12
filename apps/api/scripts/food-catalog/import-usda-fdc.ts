import { readFile } from 'node:fs/promises';

import { FoodCatalogSource, PreferredLocale, PrismaClient } from '@prisma/client';

import {
  prepareUsdaFdcImport,
  type PreparedUsdaFdcFood
} from '../../src/modules/food-catalog/usda-fdc-import';

type ImportOptions = {
  apply: boolean;
  inputPath: string;
  limit: number | null;
  dataTypes: string[];
};

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const payload = JSON.parse(await readFile(options.inputPath, 'utf8')) as unknown;
  const prepared = prepareUsdaFdcImport(payload, options.dataTypes);
  const eligible = prepared.foods.length;
  const foods = options.limit === null ? prepared.foods : prepared.foods.slice(0, options.limit);

  if (!options.apply) {
    console.log(JSON.stringify({
      mode: 'dry-run',
      eligible,
      selectedForImport: foods.length,
      skipped: summarizeSkipped(prepared.skipped),
      sample: foods.slice(0, 5).map((food) => ({
        sourceFoodId: food.sourceFoodId,
        name: food.name,
        category: food.category
      }))
    }, null, 2));
    return;
  }

  const prisma = new PrismaClient();
  try {
    const result = await importFoods(prisma, foods);
    console.log(JSON.stringify({
      mode: 'applied',
      ...result,
      skipped: prepared.skipped.length,
      note: 'USDA foods are imported inactive and require catalog review before plan generation.'
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

function summarizeSkipped(skipped: Array<{ reason: string }>) {
  return skipped.reduce<Record<string, number>>((summary, item) => {
    summary[item.reason] = (summary[item.reason] ?? 0) + 1;
    return summary;
  }, {});
}

export async function importFoods(prisma: PrismaClient, foods: PreparedUsdaFdcFood[]) {
  let createdOrUpdated = 0;
  let skippedReviewed = 0;

  for (const food of foods) {
    const existing = await prisma.foodCatalogItem.findUnique({
      where: {
        source_sourceFoodId: {
          source: FoodCatalogSource.USDA_FDC,
          sourceFoodId: food.sourceFoodId
        }
      },
      select: { id: true, isActive: true }
    });

    // An active USDA entry has been reviewed locally; imports must not overwrite it.
    if (existing?.isActive) {
      skippedReviewed += 1;
      continue;
    }

    const item = await prisma.foodCatalogItem.upsert({
      where: {
        source_sourceFoodId: {
          source: FoodCatalogSource.USDA_FDC,
          sourceFoodId: food.sourceFoodId
        }
      },
      create: {
        slug: food.slug,
        source: FoodCatalogSource.USDA_FDC,
        sourceFoodId: food.sourceFoodId,
        category: food.category,
        caloriesPer100g: food.caloriesPer100g,
        proteinPer100g: food.proteinPer100g,
        carbsPer100g: food.carbsPer100g,
        fatPer100g: food.fatPer100g,
        fiberPer100g: food.fiberPer100g,
        dietTypes: food.dietTypes,
        restrictionTags: [],
        isActive: false,
        sortOrder: 10_000
      },
      update: {
        category: food.category,
        caloriesPer100g: food.caloriesPer100g,
        proteinPer100g: food.proteinPer100g,
        carbsPer100g: food.carbsPer100g,
        fatPer100g: food.fatPer100g,
        fiberPer100g: food.fiberPer100g
      }
    });

    await prisma.foodCatalogTranslation.upsert({
      where: {
        foodCatalogItemId_locale: {
          foodCatalogItemId: item.id,
          locale: PreferredLocale.EN_US
        }
      },
      create: {
        foodCatalogItemId: item.id,
        locale: PreferredLocale.EN_US,
        name: food.name,
        aliases: []
      },
      update: {
        name: food.name,
        aliases: []
      }
    });
    createdOrUpdated += 1;
  }

  return { createdOrUpdated, skippedReviewed };
}

function parseOptions(args: string[]): ImportOptions {
  const apply = args.includes('--apply');
  const inputPath = optionValue(args, '--input') ?? process.env.USDA_FDC_INPUT_PATH;
  if (!inputPath) {
    throw new Error('Provide --input <path> or USDA_FDC_INPUT_PATH. The importer never downloads data during plan generation.');
  }

  const rawLimit = optionValue(args, '--limit');
  const limit = rawLimit === undefined ? null : Number(rawLimit);
  if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
    throw new Error('--limit must be a positive integer.');
  }

  const dataTypes = (optionValue(args, '--data-types') ?? 'Foundation')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (!dataTypes.length) throw new Error('--data-types must include at least one USDA data type.');

  return { apply, inputPath, limit, dataTypes };
}

function optionValue(args: string[], key: string) {
  const directIndex = args.indexOf(key);
  if (directIndex >= 0) return args[directIndex + 1];
  return args.find((argument) => argument.startsWith(`${key}=`))?.slice(key.length + 1);
}

if (require.main === module) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
