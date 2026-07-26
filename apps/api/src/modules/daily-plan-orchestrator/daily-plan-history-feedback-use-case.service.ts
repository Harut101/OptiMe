import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import type {
  GetDailyPlanHistoryInput,
  SubmitDailyPlanFeedbackInput
} from './daily-plan-history-feedback-use-case.interface';
import { toDailyPlanResponse } from './daily-plan-response.mapper';

@Injectable()
export class DailyPlanHistoryFeedbackUseCaseService {
  constructor(private readonly prisma: PrismaService) {}

  async getHistory(input: GetDailyPlanHistoryInput) {
    const plans = await this.prisma.dailyPlan.findMany({
      where: { userId: input.userId },
      orderBy: [
        { planLocalDate: 'desc' },
        { updatedAt: 'desc' }
      ],
      take: this.normalizeHistoryLimit(input.limit)
    });

    return {
      items: plans.map(toDailyPlanResponse)
    };
  }

  async submitFeedback(
    input: SubmitDailyPlanFeedbackInput
  ) {
    const plan = await this.prisma.dailyPlan.findFirst({
      where: {
        id: input.dailyPlanId,
        userId: input.userId
      },
      select: { id: true }
    });

    if (!plan) {
      throw new NotFoundException('Daily plan not found.');
    }

    const feedback =
      await this.prisma.dailyPlanFeedback.upsert({
        where: {
          userId_dailyPlanId: {
            userId: input.userId,
            dailyPlanId: input.dailyPlanId
          }
        },
        update: {
          rating: input.rating,
          tags: input.tags ?? [],
          notes: input.notes?.trim() || null
        },
        create: {
          userId: input.userId,
          dailyPlanId: input.dailyPlanId,
          rating: input.rating,
          tags: input.tags ?? [],
          notes: input.notes?.trim() || null
        }
      });

    return {
      id: feedback.id,
      dailyPlanId: feedback.dailyPlanId,
      rating: feedback.rating,
      tags: feedback.tags,
      notes: feedback.notes,
      createdAt: feedback.createdAt.toISOString(),
      updatedAt: feedback.updatedAt.toISOString()
    };
  }

  private normalizeHistoryLimit(limit?: string) {
    const parsedLimit = Number(limit);

    if (!Number.isFinite(parsedLimit)) {
      return 10;
    }

    return Math.min(
      Math.max(Math.trunc(parsedLimit), 1),
      30
    );
  }
}
