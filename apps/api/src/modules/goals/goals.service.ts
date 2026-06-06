import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { SafetyService } from '../safety/safety.service';
import { UpsertGoalDto } from './dto/upsert-goal.dto';

@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly safetyService: SafetyService
  ) {}

  async upsertGoal(userId: string, dto: UpsertGoalDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        isMinor: true,
        profile: {
          select: {
            weightKg: true,
            pregnancyStatus: true
          }
        }
      }
    });

    const safeGoal = this.safetyService.validateGoal({
      goalType: dto.goalType,
      targetWeightKg: dto.targetWeightKg,
      targetTimelineDays: dto.targetTimelineDays,
      impactMode: dto.impactMode,
      currentWeightKg: user.profile?.weightKg,
      isMinor: user.isMinor,
      pregnancyStatus: user.profile?.pregnancyStatus
    });

    return this.prisma.goal.upsert({
      where: { userId },
      update: {
        goalType: safeGoal.goalType,
        targetWeightKg: safeGoal.targetWeightKg,
        targetTimelineDays: safeGoal.targetTimelineDays,
        impactMode: safeGoal.impactMode
      },
      create: {
        userId,
        goalType: safeGoal.goalType,
        targetWeightKg: safeGoal.targetWeightKg,
        targetTimelineDays: safeGoal.targetTimelineDays,
        impactMode: safeGoal.impactMode
      }
    });
  }
}
