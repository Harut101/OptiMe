import { FoodCatalogSource, PrismaClient } from '@prisma/client';

type ListOptions = {
  active: boolean | null;
  limit: number;
};

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const prisma = new PrismaClient();

  try {
    const foods = await prisma.foodCatalogItem.findMany({
      where: {
        source: FoodCatalogSource.USDA_FDC,
        ...(options.active === null ? {} : { isActive: options.active })
      },
      include: {
        translations: {
          where: { locale: 'EN_US' },
          select: { name: true }
        }
      },
      orderBy: [{ isActive: 'asc' }, { sourceFoodId: 'asc' }],
      take: options.limit
    });

    console.log(JSON.stringify({
      count: foods.length,
      foods: foods.map((food) => ({
        sourceFoodId: food.sourceFoodId,
        name: food.translations[0]?.name ?? food.slug,
        category: food.category,
        active: food.isActive,
        nutritionPer100g: {
          caloriesKcal: food.caloriesPer100g,
          proteinGrams: Number(food.proteinPer100g),
          carbsGrams: Number(food.carbsPer100g),
          fatGrams: Number(food.fatPer100g),
          fiberGrams: food.fiberPer100g === null ? null : Number(food.fiberPer100g)
        }
      }))
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

function parseOptions(args: string[]): ListOptions {
  const activeOption = optionValue(args, '--active');
  if (activeOption !== undefined && activeOption !== 'true' && activeOption !== 'false') {
    throw new Error('--active must be true or false when provided.');
  }

  const rawLimit = optionValue(args, '--limit') ?? '100';
  const limit = Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new Error('--limit must be an integer between 1 and 500.');
  }

  return {
    active: activeOption === undefined ? null : activeOption === 'true',
    limit
  };
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
