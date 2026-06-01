import { PrismaService } from '../../src/prisma/prisma.service';

export async function cleanupDatabase(prisma: PrismaService) {
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
