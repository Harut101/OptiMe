import { PrismaClient } from '@prisma/client';
import { exerciseCatalog } from './index';
import { validateExerciseCatalog, validateSeededExerciseDatabase } from './validate-catalog';

async function main() {
  const catalog = validateExerciseCatalog(exerciseCatalog);
  if (!process.argv.includes('--database')) {
    console.log(`Exercise catalog valid: ${catalog.exerciseCount} exercises, ${catalog.translationCount} translations, ${catalog.mediaCount} media.`);
    return;
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required when validating the seeded ExerciseLibrary database.');
  }
  const prisma = new PrismaClient();
  try {
    const databaseCount = await validateSeededExerciseDatabase(prisma, catalog.exerciseCount);
    console.log(`Exercise library valid: ${catalog.exerciseCount} seed exercises, ${catalog.translationCount} translations, ${databaseCount} database exercises.`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
