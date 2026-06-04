import { PrismaService } from '../../src/prisma/prisma.service';

export async function cleanupDatabase(prisma: PrismaService) {
  assertTestDatabase();

  await prisma.dailyPlanFeedback.deleteMany();
  await prisma.dailyPlan.deleteMany();
  await prisma.trainingScheduleItem.deleteMany();
  await prisma.allergy.deleteMany();
  await prisma.excludedFood.deleteMany();
  await prisma.preferredFood.deleteMany();
  await prisma.nutritionPreference.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();
}

function assertTestDatabase() {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  const activeDatabaseUrl = process.env.DATABASE_URL;

  if (!testDatabaseUrl) {
    throw new Error('TEST_DATABASE_URL is required before cleanupDatabase can run.');
  }

  if (!testDatabaseUrl.includes('/optime_test')) {
    throw new Error('TEST_DATABASE_URL must point to the optime_test database.');
  }

  if (activeDatabaseUrl !== testDatabaseUrl) {
    throw new Error('Refusing to cleanup database because DATABASE_URL is not TEST_DATABASE_URL.');
  }
}
