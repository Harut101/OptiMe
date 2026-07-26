import request from 'supertest';
import {
  DailyReadinessLevel,
  HealthProvider,
  PlanStatus,
  Prisma
} from '@prisma/client';
import type { PlanCheckpointFacts } from '@optime/shared-types';

import { createSafeFallbackPlan } from '../src/modules/safety/safe-fallback-plan.factory';
import { authHeader, registerTestUser } from './helpers/auth';
import { cleanupDatabase } from './helpers/cleanup';
import { createTestApp, TestApp } from './helpers/test-app';

describe('Adaptive plan checkpoint evaluation', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await cleanupDatabase(ctx.prisma);
  });

  afterAll(async () => {
    if (ctx) {
      await cleanupDatabase(ctx.prisma);
      await ctx.app.close();
    }
  });

  it('requires authentication', async () => {
    await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/plan-1/checkpoint/evaluate')
      .send({ trigger: 'APP_OPEN' })
      .expect(401);
  });

  it('initializes an old plan baseline without a false review prompt', async () => {
    const user = await registerTestUser(ctx.app);
    const plan = await createPlan(user.user.id);

    const response = await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${plan.id}/checkpoint/evaluate`)
      .set(authHeader(user.accessToken))
      .send({ trigger: 'APP_OPEN' })
      .expect(201);

    expect(response.body).toMatchObject({
      dailyPlanId: plan.id,
      planLocalDate: plan.planLocalDate,
      baselineInitialized: true,
      materialChangeDetected: false,
      reviewRecommended: false,
      severity: 'NONE',
      reasonCodes: []
    });

    const saved = await ctx.prisma.dailyPlan.findUniqueOrThrow({
      where: { id: plan.id }
    });
    expect(
      (saved.planJson as Record<string, unknown>).checkpointBaseline
    ).toBeDefined();
  });

  it('detects current health changes against the saved baseline', async () => {
    const user = await registerTestUser(ctx.app);
    const baseline = createBaseline(480);
    const plan = await createPlan(user.user.id, baseline);
    await ctx.prisma.wearableDailySnapshot.create({
      data: {
        userId: user.user.id,
        source: HealthProvider.APPLE_HEALTH,
        localDate: plan.planLocalDate,
        timezone: 'UTC',
        sleepMinutes: 300,
        capturedAt: new Date('2026-07-26T10:00:00.000Z')
      }
    });

    const response = await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${plan.id}/checkpoint/evaluate`)
      .set(authHeader(user.accessToken))
      .send({ trigger: 'HEALTH_SYNC' })
      .expect(201);

    expect(response.body).toMatchObject({
      baselineInitialized: false,
      materialChangeDetected: true,
      reviewRecommended: true,
      severity: 'HIGH'
    });
    expect(response.body.reasonCodes).toEqual(
      expect.arrayContaining(['LOW_SLEEP_DETECTED', 'SLEEP_DECREASED'])
    );
  });

  it('does not allow another user to evaluate the plan', async () => {
    const owner = await registerTestUser(ctx.app);
    const otherUser = await registerTestUser(ctx.app);
    const plan = await createPlan(owner.user.id, createBaseline(480));

    await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${plan.id}/checkpoint/evaluate`)
      .set(authHeader(otherUser.accessToken))
      .send({ trigger: 'APP_OPEN' })
      .expect(404);
  });

  async function createPlan(userId: string, checkpointBaseline?: PlanCheckpointFacts) {
    const planJson = {
      ...createSafeFallbackPlan({
        planLocalDate: '2026-07-26',
        planTimezone: 'UTC'
      }),
      ...(checkpointBaseline ? { checkpointBaseline } : {})
    };

    return ctx.prisma.dailyPlan.create({
      data: {
        userId,
        planLocalDate: '2026-07-26',
        planTimezone: 'UTC',
        status: PlanStatus.READY,
        readinessLevel: DailyReadinessLevel.MAINTAIN,
        planJson: planJson as unknown as Prisma.JsonObject
      }
    });
  }
});

function createBaseline(sleepMinutes: number): PlanCheckpointFacts {
  return {
    capturedAt: '2026-07-26T08:00:00.000Z',
    health: {
      source: 'APPLE_HEALTH',
      localDate: '2026-07-26',
      sleepMinutes,
      steps: 1000,
      activeCaloriesKcal: 100,
      workoutMinutes: 0
    },
    progress: {
      completedMeals: 0,
      skippedMeals: 0,
      workoutStatus: 'NOT_STARTED'
    },
    checkIn: {
      energyLevel: null,
      tirednessLevel: null,
      sorenessLevel: null
    },
    safetySignals: {
      painOrLimitation: false,
      illness: false,
      dizziness: false,
      exhaustion: false
    }
  };
}
