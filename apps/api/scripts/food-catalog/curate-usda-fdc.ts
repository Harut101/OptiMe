import { readFile } from 'node:fs/promises';

import { PrismaClient } from '@prisma/client';

import {
  applyUsdaFdcCuration,
  parseUsdaFdcCurationManifest
} from '../../src/modules/food-catalog/usda-fdc-curation';

async function main() {
  const args = process.argv.slice(2);
  const inputPath = optionValue(args, '--input') ?? process.env.USDA_FDC_CURATION_PATH;
  if (!inputPath) {
    throw new Error('Provide --input <path> or USDA_FDC_CURATION_PATH.');
  }

  const manifest = parseUsdaFdcCurationManifest(
    JSON.parse(await readFile(inputPath, 'utf8')) as unknown
  );
  if (!args.includes('--apply')) {
    console.log(JSON.stringify({
      mode: 'dry-run',
      reviewedFoods: manifest.foods.length,
      sourceFoodIds: manifest.foods.map((food) => food.sourceFoodId)
    }, null, 2));
    return;
  }

  const prisma = new PrismaClient();
  try {
    const result = await applyUsdaFdcCuration(prisma, manifest);
    console.log(JSON.stringify({ mode: 'applied', ...result }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
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
