import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(userId: string) {
    const [user, profile, goal, nutritionPreferences, trainingScheduleCount] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { privacyConsentedAt: true }
      }),
      this.prisma.profile.findUnique({ where: { userId }, select: { id: true } }),
      this.prisma.goal.findUnique({ where: { userId }, select: { id: true } }),
      this.prisma.nutritionPreference.findUnique({ where: { userId }, select: { id: true } }),
      this.prisma.trainingScheduleItem.count({ where: { userId } })
    ]);

    const profileCompleted = Boolean(profile);
    const goalCompleted = Boolean(goal);
    const nutritionPreferencesCompleted = Boolean(nutritionPreferences);
    const trainingScheduleCompleted = trainingScheduleCount > 0;
    const privacyConsentCompleted = Boolean(user.privacyConsentedAt);

    return {
      profileCompleted,
      goalCompleted,
      nutritionPreferencesCompleted,
      trainingScheduleCompleted,
      privacyConsentCompleted,
      canGeneratePlan:
        profileCompleted &&
        goalCompleted &&
        nutritionPreferencesCompleted &&
        trainingScheduleCompleted &&
        privacyConsentCompleted
    };
  }
}
