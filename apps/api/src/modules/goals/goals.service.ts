import { BadRequestException, Injectable } from '@nestjs/common';
import { Goal, GoalImpactMode, GoalType, PrimaryGoal } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { SafetyService } from '../safety/safety.service';
import { UpsertGoalDto } from './dto/upsert-goal.dto';

@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly safetyService: SafetyService
  ) {}

  async getGoal(userId: string) {
    const goal = await this.prisma.goal.findUnique({
      where: { userId },
      include: { user: { select: { noTrainingPlanned: true } } }
    });
    return goal ? this.toGoalResponse(goal, goal.user.noTrainingPlanned) : null;
  }

  async upsertGoal(userId: string, dto: UpsertGoalDto) {
    const normalizedGoalType = dto.goalType ?? this.goalTypeFromPrimaryGoal(dto.primaryGoal);
    const normalizedPrimaryGoal = dto.primaryGoal ?? this.primaryGoalFromGoalType(normalizedGoalType);

    if (!normalizedGoalType || !normalizedPrimaryGoal) {
      throw new BadRequestException('Either goalType or primaryGoal is required.');
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        isMinor: true,
        noTrainingPlanned: true,
        profile: {
          select: {
            weightKg: true,
            pregnancyStatus: true
          }
        }
      }
    });
    const requestedAppMode = dto.appMode;
    const requestedImpactMode = requestedAppMode ?? (normalizedGoalType === GoalType.REDUCE_WEIGHT ? dto.impactMode : undefined);

    const safeGoal = this.safetyService.validateGoal({
      goalType: normalizedGoalType,
      targetWeightKg: dto.targetWeightKg,
      targetTimelineDays: dto.targetTimelineDays,
      impactMode: requestedImpactMode,
      currentWeightKg: user.profile?.weightKg,
      isMinor: user.isMinor,
      pregnancyStatus: user.profile?.pregnancyStatus
    });
    const finalImpactMode = safeGoal.adjustedForSafety && !requestedAppMode
      ? null
      : (safeGoal.impactMode ?? requestedAppMode ?? null);

    const saved = await this.prisma.$transaction(async (tx) => {
      const goal = await tx.goal.upsert({
        where: { userId },
        update: {
          goalType: safeGoal.goalType,
          primaryGoal: this.primaryGoalFromGoalType(safeGoal.goalType) ?? normalizedPrimaryGoal,
          targetWeightKg: safeGoal.targetWeightKg,
          targetTimelineDays: safeGoal.targetTimelineDays,
          impactMode: finalImpactMode
        },
        create: {
          userId,
          goalType: safeGoal.goalType,
          primaryGoal: this.primaryGoalFromGoalType(safeGoal.goalType) ?? normalizedPrimaryGoal,
          targetWeightKg: safeGoal.targetWeightKg,
          targetTimelineDays: safeGoal.targetTimelineDays,
          impactMode: finalImpactMode
        }
      });

      if (requestedAppMode) {
        await tx.user.update({
          where: { id: userId },
          data: { noTrainingPlanned: requestedAppMode === GoalImpactMode.NUTRITION_ONLY }
        });
      }

      return goal;
    });

    return this.toGoalResponse(
      saved,
      requestedAppMode ? requestedAppMode === GoalImpactMode.NUTRITION_ONLY : user.noTrainingPlanned
    );
  }

  private toGoalResponse(goal: Goal, noTrainingPlanned: boolean) {
    const appMode = goal.impactMode ?? (noTrainingPlanned ? GoalImpactMode.NUTRITION_ONLY : GoalImpactMode.NUTRITION_AND_TRAINING);
    const primaryGoal = goal.primaryGoal ?? this.primaryGoalFromGoalType(goal.goalType);

    return {
      ...goal,
      primaryGoal,
      appMode,
      impactMode: goal.impactMode
    };
  }

  private goalTypeFromPrimaryGoal(primaryGoal?: PrimaryGoal) {
    if (!primaryGoal) return undefined;
    if (primaryGoal === PrimaryGoal.WEIGHT_LOSS) return GoalType.REDUCE_WEIGHT;
    if (primaryGoal === PrimaryGoal.WEIGHT_GAIN) return GoalType.BUILD_MUSCLE;
    return GoalType.HEALTHY_LIFESTYLE;
  }

  private primaryGoalFromGoalType(goalType?: GoalType | null) {
    if (goalType === GoalType.REDUCE_WEIGHT) return PrimaryGoal.WEIGHT_LOSS;
    if (goalType === GoalType.BUILD_MUSCLE) return PrimaryGoal.WEIGHT_GAIN;
    if (goalType === GoalType.HEALTHY_LIFESTYLE) return PrimaryGoal.HEALTHY_EATING;
    if (goalType === GoalType.IMPROVE_FITNESS || goalType === GoalType.IMPROVE_ENDURANCE) return PrimaryGoal.WEIGHT_MAINTENANCE;
    return PrimaryGoal.HEALTHY_EATING;
  }
}
