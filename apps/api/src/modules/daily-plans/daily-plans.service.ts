import { Injectable } from '@nestjs/common';
import { DailyReadinessLevel, PlanStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { GenerateDailyPlanDto } from './dto/generate-daily-plan.dto';
import { createMockDailyPlan } from './templates/mock-daily-plan.factory';

@Injectable()
export class DailyPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async getTodayPlan(userId: string) {
    const user = await this.getPlanningUser(userId);
    const { planLocalDate, planTimezone } = this.getLocalPlanDate(user.timezone);

    const plan = await this.prisma.dailyPlan.findUnique({
      where: {
        userId_planLocalDate_planTimezone: {
          userId,
          planLocalDate,
          planTimezone
        }
      }
    });

    return plan ? this.toResponse(plan) : null;
  }

  async generateTodayPlan(userId: string, dto: GenerateDailyPlanDto) {
    const user = await this.getPlanningUser(userId);
    const { planLocalDate, planTimezone } = this.getLocalPlanDate(user.timezone);

    const existingPlan = await this.prisma.dailyPlan.findUnique({
      where: {
        userId_planLocalDate_planTimezone: {
          userId,
          planLocalDate,
          planTimezone
        }
      }
    });

    if (existingPlan && !dto.forceRegenerate) {
      return this.toResponse(existingPlan);
    }

    const mockPlan = createMockDailyPlan({
      planLocalDate,
      planTimezone,
      firstName: user.firstName,
      isMinor: user.isMinor
    }) as Prisma.JsonObject;

    const plan = existingPlan
      ? await this.prisma.dailyPlan.update({
          where: { id: existingPlan.id },
          data: {
            status: PlanStatus.READY,
            readinessLevel: DailyReadinessLevel.MAINTAIN,
            planJson: mockPlan,
            createdByAi: false
          }
        })
      : await this.prisma.dailyPlan.create({
          data: {
            userId,
            planLocalDate,
            planTimezone,
            status: PlanStatus.READY,
            readinessLevel: DailyReadinessLevel.MAINTAIN,
            planJson: mockPlan,
            createdByAi: false
          }
        });

    return this.toResponse(plan);
  }

  private getPlanningUser(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        timezone: true,
        isMinor: true
      }
    });
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

  private toResponse(plan: {
    id: string;
    status: string;
    readinessLevel: string;
    planLocalDate: string;
    planTimezone: string;
    planJson: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      planId: plan.id,
      status: plan.status,
      readinessLevel: plan.readinessLevel,
      planLocalDate: plan.planLocalDate,
      planTimezone: plan.planTimezone,
      plan: plan.planJson,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt
    };
  }
}
