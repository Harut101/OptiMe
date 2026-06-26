import { Injectable, UnauthorizedException } from '@nestjs/common';
import { GoalImpactMode, PrimaryGoal } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { HealthService } from '../health/health.service';
import { TrainingScheduleResolverService } from '../training-schedule/training-schedule-resolver.service';

@Injectable()
export class NutritionTargetInputResolver {
  constructor(
    private readonly prisma: PrismaService,
    private readonly healthService: HealthService,
    private readonly trainingScheduleResolver: TrainingScheduleResolverService
  ) {}

  async resolve(userId: string, planLocalDate?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        timezone: true,
        isMinor: true,
        safeMode: true,
        noTrainingPlanned: true,
        profile: {
          select: {
            gender: true,
            pregnancyStatus: true,
            dateOfBirth: true,
            heightCm: true,
            weightKg: true,
            activityLevel: true
          }
        },
        goal: {
          select: {
            goalType: true,
            primaryGoal: true,
            targetWeightKg: true,
            targetTimelineDays: true,
            impactMode: true
          }
        },
        schedules: {
          select: {
            dayOfWeek: true,
            durationMinutes: true
          }
        },
        trainingPreference: {
          select: {
            targetMuscleGroups: true,
            equipment: true,
            trainingLevel: true,
            limitationsOrPainAreas: true
          }
        }
      }
    });

    if (!user) {
      throw new UnauthorizedException('Your session is no longer valid. Please log in again.');
    }

    const localDate = planLocalDate ?? this.getLocalPlanDate(user.timezone).planLocalDate;
    const appMode = user.goal?.impactMode ??
      (user.noTrainingPlanned ? GoalImpactMode.NUTRITION_ONLY : GoalImpactMode.NUTRITION_AND_TRAINING);
    const trainingEnabled = appMode === GoalImpactMode.NUTRITION_AND_TRAINING && !user.noTrainingPlanned;
    const resolvedTrainingDay = await this.trainingScheduleResolver.resolveForUser({
      userId,
      planLocalDate: localDate,
      trainingPreference: user.trainingPreference,
      legacyScheduleItems: user.schedules,
      noTrainingPlanned: !trainingEnabled
    });
    const healthPlanningContext = await this.healthService.getRecentHealthSummariesForPlanning(userId, {
      planLocalDate: localDate,
      days: 7
    });

    return {
      user,
      planLocalDate: localDate,
      appMode,
      trainingEnabled,
      primaryGoal: user.goal?.primaryGoal ?? PrimaryGoal.HEALTHY_EATING,
      resolvedTrainingDay,
      healthPlanningContext
    };
  }

  private getLocalPlanDate(timezone: string) {
    const safeTimezone = this.normalizeTimezone(timezone);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: safeTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());

    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    return {
      planLocalDate: `${year}-${month}-${day}`,
      planTimezone: safeTimezone
    };
  }

  private normalizeTimezone(timezone: string) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
      return timezone;
    } catch {
      return 'UTC';
    }
  }
}

export type ResolvedNutritionTargetInput = Awaited<ReturnType<NutritionTargetInputResolver['resolve']>>;
