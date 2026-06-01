import { Injectable } from '@nestjs/common';
import { GoalType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { UpsertGoalDto } from './dto/upsert-goal.dto';

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  upsertGoal(userId: string, dto: UpsertGoalDto) {
    const isWeightLossGoal = dto.goalType === GoalType.REDUCE_WEIGHT;

    return this.prisma.goal.upsert({
      where: { userId },
      update: {
        goalType: dto.goalType,
        targetWeightKg: isWeightLossGoal ? dto.targetWeightKg : null,
        targetTimelineDays: isWeightLossGoal ? dto.targetTimelineDays : null,
        impactMode: isWeightLossGoal ? dto.impactMode : null
      },
      create: {
        userId,
        goalType: dto.goalType,
        targetWeightKg: isWeightLossGoal ? dto.targetWeightKg : null,
        targetTimelineDays: isWeightLossGoal ? dto.targetTimelineDays : null,
        impactMode: isWeightLossGoal ? dto.impactMode : null
      }
    });
  }
}
