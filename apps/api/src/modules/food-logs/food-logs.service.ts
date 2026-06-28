import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  FoodLogMealType,
  FoodMealProgressStatus,
  Prisma
} from '@prisma/client';
import type { DailyFoodPlan, FoodMeal } from '@optime/shared-types';

import { PrismaService } from '../../prisma/prisma.service';
import { normalizeDailyPlanJson } from '../daily-plans/daily-plan-normalizer';
import { UpdateFoodMealStatusDto } from './dto/update-food-meal-status.dto';

type FoodDayLogWithProgress = Prisma.FoodDayLogGetPayload<{
  include: { mealProgress: true };
}>;

interface PlannedMealSnapshot {
  mealId: string;
  mealOrder: number;
  mealType: FoodLogMealType;
  mealTitleSnapshot: string;
}

@Injectable()
export class FoodLogsService {
  private readonly logger = new Logger(FoodLogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getFoodLog(userId: string, dailyPlanId: string) {
    const plan = await this.getOwnedDailyPlan(userId, dailyPlanId);
    const meals = this.getStructuredMeals(plan);

    if (!meals.length) {
      return this.toUnsupportedResponse(dailyPlanId, plan.planLocalDate);
    }

    const log = await this.prisma.foodDayLog.findUnique({
      where: { userId_dailyPlanId: { userId, dailyPlanId } },
      include: { mealProgress: true }
    });

    if (!log) {
      return this.toUnpersistedResponse(dailyPlanId, plan.planLocalDate, meals);
    }

    const synced = await this.syncLogWithMeals(log, meals);
    return this.toResponse(synced);
  }

  async updateMealStatus(
    userId: string,
    dailyPlanId: string,
    mealId: string,
    dto: UpdateFoodMealStatusDto
  ) {
    const plan = await this.getOwnedDailyPlan(userId, dailyPlanId);
    const meals = this.getStructuredMeals(plan);

    if (!meals.length) {
      throw new BadRequestException('Meal tracking is available for structured meal plans.');
    }

    if (!meals.some((meal) => meal.mealId === mealId)) {
      throw new BadRequestException('Meal is not available in the current food plan.');
    }

    const before = await this.prisma.foodMealProgress.findFirst({
      where: {
        mealId,
        foodDayLog: {
          userId,
          dailyPlanId
        }
      }
    });
    const log = await this.ensureSyncedLog(userId, dailyPlanId, plan.planLocalDate, meals);
    await this.prisma.foodMealProgress.update({
      where: {
        foodDayLogId_mealId: {
          foodDayLogId: log.id,
          mealId
        }
      },
      data: { status: dto.status }
    });
    const updated = await this.recalculateCounts(log.id);

    this.logger.log(
      `food meal status updated; dailyPlanId=${dailyPlanId}; mealId=${mealId}; oldStatus=${before?.status ?? FoodMealProgressStatus.PLANNED}; newStatus=${dto.status}; completed=${updated.completedMealCount}; partial=${updated.partialMealCount}; skipped=${updated.skippedMealCount}; planned=${updated.plannedMealCount}`
    );

    return this.toResponse(updated);
  }

  private async getOwnedDailyPlan(userId: string, dailyPlanId: string) {
    const plan = await this.prisma.dailyPlan.findFirst({
      where: { id: dailyPlanId, userId }
    });

    if (!plan) {
      throw new NotFoundException('Daily plan not found.');
    }

    return plan;
  }

  private getStructuredMeals(plan: {
    planJson: Prisma.JsonValue;
    planLocalDate: string;
    planTimezone: string;
    readinessLevel: string;
  }): PlannedMealSnapshot[] {
    const planJson = normalizeDailyPlanJson({
      planJson: plan.planJson,
      planLocalDate: plan.planLocalDate,
      planTimezone: plan.planTimezone,
      readinessLevel: plan.readinessLevel
    });
    const foodPlan = planJson.nutrition.foodPlan as DailyFoodPlan | undefined;

    if (!foodPlan?.meals?.length) {
      return [];
    }

    return foodPlan.meals
      .filter((meal) => meal.id.trim().length > 0)
      .map((meal, index) => this.toMealSnapshot(meal, index));
  }

  private toMealSnapshot(meal: FoodMeal, index: number): PlannedMealSnapshot {
    return {
      mealId: meal.id,
      mealOrder: index,
      mealType: meal.mealType as FoodLogMealType,
      mealTitleSnapshot: meal.title
    };
  }

  private async ensureSyncedLog(
    userId: string,
    dailyPlanId: string,
    localDate: string,
    meals: PlannedMealSnapshot[]
  ) {
    let log = await this.prisma.foodDayLog.upsert({
      where: { userId_dailyPlanId: { userId, dailyPlanId } },
      create: {
        userId,
        dailyPlanId,
        localDate,
        plannedMealCount: meals.length,
        completedMealCount: 0,
        partialMealCount: 0,
        skippedMealCount: 0
      },
      update: { localDate },
      include: { mealProgress: true }
    });

    log = await this.syncLogWithMeals(log, meals);

    this.logger.log(
      `food log synced; dailyPlanId=${dailyPlanId}; mealCount=${meals.length}; logId=${log.id}`
    );

    return log;
  }

  private async syncLogWithMeals(
    log: FoodDayLogWithProgress,
    meals: PlannedMealSnapshot[]
  ) {
    const currentMealIds = new Set(meals.map((meal) => meal.mealId));
    const staleIds = log.mealProgress
      .filter((progress) => !currentMealIds.has(progress.mealId))
      .map((progress) => progress.id);

    if (staleIds.length) {
      await this.prisma.foodMealProgress.deleteMany({
        where: { id: { in: staleIds } }
      });
    }

    for (const meal of meals) {
      await this.prisma.foodMealProgress.upsert({
        where: {
          foodDayLogId_mealId: {
            foodDayLogId: log.id,
            mealId: meal.mealId
          }
        },
        create: {
          foodDayLogId: log.id,
          mealId: meal.mealId,
          mealOrder: meal.mealOrder,
          mealType: meal.mealType,
          mealTitleSnapshot: meal.mealTitleSnapshot,
          status: FoodMealProgressStatus.PLANNED
        },
        update: {
          mealOrder: meal.mealOrder,
          mealType: meal.mealType,
          mealTitleSnapshot: meal.mealTitleSnapshot
        }
      });
    }

    return this.recalculateCounts(log.id, meals.length);
  }

  private async recalculateCounts(foodDayLogId: string, plannedMealCount?: number) {
    const progress = await this.prisma.foodMealProgress.findMany({
      where: { foodDayLogId },
      orderBy: { mealOrder: 'asc' }
    });
    const counts = {
      plannedMealCount: plannedMealCount ?? progress.length,
      completedMealCount: progress.filter((meal) => meal.status === FoodMealProgressStatus.EATEN).length,
      partialMealCount: progress.filter((meal) => meal.status === FoodMealProgressStatus.PARTIALLY_EATEN).length,
      skippedMealCount: progress.filter((meal) => meal.status === FoodMealProgressStatus.SKIPPED).length
    };

    return this.prisma.foodDayLog.update({
      where: { id: foodDayLogId },
      data: counts,
      include: { mealProgress: { orderBy: { mealOrder: 'asc' } } }
    });
  }

  private toUnsupportedResponse(dailyPlanId: string, localDate: string) {
    return {
      id: null,
      dailyPlanId,
      localDate,
      supported: false,
      unsupportedReason: 'NO_STRUCTURED_FOOD_PLAN' as const,
      plannedMealCount: 0,
      completedMealCount: 0,
      partialMealCount: 0,
      skippedMealCount: 0,
      markedMealCount: 0,
      mealProgress: [],
      updatedAt: null
    };
  }

  private toUnpersistedResponse(
    dailyPlanId: string,
    localDate: string,
    meals: PlannedMealSnapshot[]
  ) {
    return {
      id: null,
      dailyPlanId,
      localDate,
      supported: true,
      plannedMealCount: meals.length,
      completedMealCount: 0,
      partialMealCount: 0,
      skippedMealCount: 0,
      markedMealCount: 0,
      mealProgress: meals.map((meal) => ({
        id: `planned:${meal.mealId}`,
        mealId: meal.mealId,
        mealOrder: meal.mealOrder,
        mealType: meal.mealType,
        mealTitleSnapshot: meal.mealTitleSnapshot,
        status: FoodMealProgressStatus.PLANNED,
        updatedAt: null
      })),
      updatedAt: null
    };
  }

  private toResponse(log: FoodDayLogWithProgress) {
    return {
      id: log.id,
      dailyPlanId: log.dailyPlanId,
      localDate: log.localDate,
      supported: true,
      plannedMealCount: log.plannedMealCount,
      completedMealCount: log.completedMealCount,
      partialMealCount: log.partialMealCount,
      skippedMealCount: log.skippedMealCount,
      markedMealCount: log.completedMealCount + log.partialMealCount + log.skippedMealCount,
      mealProgress: [...log.mealProgress]
        .sort((a, b) => a.mealOrder - b.mealOrder)
        .map((progress) => ({
          id: progress.id,
          mealId: progress.mealId,
          mealOrder: progress.mealOrder,
          mealType: progress.mealType,
          mealTitleSnapshot: progress.mealTitleSnapshot,
          status: progress.status,
          updatedAt: progress.updatedAt.toISOString()
        })),
      updatedAt: log.updatedAt.toISOString()
    };
  }
}
