import {
  PlanFeedbackRating,
  PlanFeedbackTag
} from '@prisma/client';

import type { PrismaService } from '../../prisma/prisma.service';
import { DailyPlanHistoryFeedbackUseCaseService } from './daily-plan-history-feedback-use-case.service';

describe('DailyPlanHistoryFeedbackUseCaseService', () => {
  it('returns only the user history with normalized plans and a clamped limit', async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma);
    prisma.dailyPlan.findMany.mockResolvedValue([
      createStoredPlan()
    ] as never);

    const result = await service.getHistory({
      userId: 'user-1',
      limit: '100'
    });

    expect(prisma.dailyPlan.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: [
        { planLocalDate: 'desc' },
        { updatedAt: 'desc' }
      ],
      take: 30
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'plan-1',
      planLocalDate: '2026-07-26',
      planTimezone: 'UTC',
      updatedAt: '2026-07-26T10:00:00.000Z',
      plan: {
        schemaVersion: 'sprint-2.v1'
      }
    });
  });

  it('uses the default history limit for an invalid query value', async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma);
    prisma.dailyPlan.findMany.mockResolvedValue([]);

    await service.getHistory({
      userId: 'user-1',
      limit: 'not-a-number'
    });

    expect(prisma.dailyPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 })
    );
  });

  it('rejects feedback when the plan does not belong to the user', async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma);
    prisma.dailyPlan.findFirst.mockResolvedValue(null);

    await expect(
      service.submitFeedback({
        userId: 'user-1',
        dailyPlanId: 'other-plan',
        rating: PlanFeedbackRating.HELPFUL
      })
    ).rejects.toThrow('Daily plan not found.');
    expect(
      prisma.dailyPlanFeedback.upsert
    ).not.toHaveBeenCalled();
  });

  it('upserts one feedback record and normalizes blank notes', async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma);
    const createdAt = new Date(
      '2026-07-26T10:00:00.000Z'
    );
    const updatedAt = new Date(
      '2026-07-26T11:00:00.000Z'
    );
    prisma.dailyPlan.findFirst.mockResolvedValue({
      id: 'plan-1'
    } as never);
    prisma.dailyPlanFeedback.upsert.mockResolvedValue({
      id: 'feedback-1',
      dailyPlanId: 'plan-1',
      rating: PlanFeedbackRating.HELPFUL,
      tags: [PlanFeedbackTag.FELT_GOOD],
      notes: null,
      createdAt,
      updatedAt
    } as never);

    const result = await service.submitFeedback({
      userId: 'user-1',
      dailyPlanId: 'plan-1',
      rating: PlanFeedbackRating.HELPFUL,
      tags: [PlanFeedbackTag.FELT_GOOD],
      notes: '   '
    });

    expect(prisma.dailyPlanFeedback.upsert).toHaveBeenCalledWith({
      where: {
        userId_dailyPlanId: {
          userId: 'user-1',
          dailyPlanId: 'plan-1'
        }
      },
      update: {
        rating: PlanFeedbackRating.HELPFUL,
        tags: [PlanFeedbackTag.FELT_GOOD],
        notes: null
      },
      create: {
        userId: 'user-1',
        dailyPlanId: 'plan-1',
        rating: PlanFeedbackRating.HELPFUL,
        tags: [PlanFeedbackTag.FELT_GOOD],
        notes: null
      }
    });
    expect(result).toEqual({
      id: 'feedback-1',
      dailyPlanId: 'plan-1',
      rating: PlanFeedbackRating.HELPFUL,
      tags: [PlanFeedbackTag.FELT_GOOD],
      notes: null,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString()
    });
  });
});

function createService(
  prisma: ReturnType<typeof createPrismaMock>
) {
  return new DailyPlanHistoryFeedbackUseCaseService(
    prisma as unknown as PrismaService
  );
}

function createPrismaMock() {
  return {
    dailyPlan: {
      findMany: jest.fn(),
      findFirst: jest.fn()
    },
    dailyPlanFeedback: {
      upsert: jest.fn()
    }
  };
}

function createStoredPlan() {
  return {
    id: 'plan-1',
    userId: 'user-1',
    planLocalDate: '2026-07-26',
    planTimezone: 'UTC',
    status: 'READY',
    readinessLevel: 'MAINTAIN',
    planJson: {
      title: 'Legacy plan',
      message: 'A compatible older plan.'
    },
    createdAt: new Date('2026-07-26T09:00:00.000Z'),
    updatedAt: new Date('2026-07-26T10:00:00.000Z')
  };
}
