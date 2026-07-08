import request from 'supertest';
import { DailyReadinessLevel, PlanStatus, Prisma } from '@prisma/client';

import { authHeader, registerTestUser } from './helpers/auth';
import { cleanupDatabase } from './helpers/cleanup';
import { createTestApp, TestApp } from './helpers/test-app';

describe('Plan impact evaluation', () => {
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
      .post('/v1/plan-impact/evaluate')
      .send({ changeTypes: ['PROFILE_WEIGHT_CHANGED'] })
      .expect(401);
  });

  it('returns no impact when there is no current daily plan', async () => {
    const user = await registerTestUser(ctx.app);

    const response = await request(ctx.app.getHttpServer())
      .post('/v1/plan-impact/evaluate')
      .set(authHeader(user.accessToken))
      .send({
        changeTypes: ['PROFILE_WEIGHT_CHANGED'],
        localDate: '2026-07-08'
      })
      .expect(201);

    expect(response.body).toMatchObject({
      affectsCurrentPlan: false,
      severity: 'NONE',
      currentDailyPlanId: null,
      prompt: null
    });
    expect(response.body.reasonCodes).toContain('NO_CURRENT_PLAN');
  });

  it('flags weight changes as nutrition and food plan impact', async () => {
    const user = await registerTestUser(ctx.app);
    const plan = await createPlan(user.user.id, '2026-07-08');

    const response = await request(ctx.app.getHttpServer())
      .post('/v1/plan-impact/evaluate')
      .set(authHeader(user.accessToken))
      .send({
        changeTypes: ['PROFILE_WEIGHT_CHANGED'],
        localDate: plan.planLocalDate
      })
      .expect(201);

    expect(response.body).toMatchObject({
      affectsCurrentPlan: true,
      currentDailyPlanId: plan.id,
      severity: 'MEDIUM',
      aiRegenerationRecommended: true,
      entitlementFeatureKey: 'DAILY_PLAN_REFRESH',
      usageCost: 1
    });
    expect(response.body.affectedSections).toEqual(
      expect.arrayContaining(['NUTRITION_TARGET', 'FOOD_PLAN'])
    );
    expect(response.body.prompt).toMatchObject({
      titleCode: 'UPDATE_TODAY_NUTRITION',
      primaryAction: 'UPDATE_TODAY_PLAN',
      secondaryAction: 'APPLY_TO_FUTURE_ONLY'
    });
  });

  it('marks newly restricted foods in the current plan as safety critical', async () => {
    const user = await registerTestUser(ctx.app);
    await createPlan(user.user.id, '2026-07-08', {
      nutrition: {
        meals: [
          {
            name: 'Breakfast',
            foods: [{ name: 'Avocado toast' }]
          }
        ]
      }
    });

    const response = await request(ctx.app.getHttpServer())
      .post('/v1/plan-impact/evaluate')
      .set(authHeader(user.accessToken))
      .send({
        changeTypes: ['EXCLUDED_FOOD_CHANGED'],
        localDate: '2026-07-08',
        newValues: { excludedFoods: ['avocado'] }
      })
      .expect(201);

    expect(response.body).toMatchObject({
      affectsCurrentPlan: true,
      severity: 'SAFETY_CRITICAL',
      safetyCritical: true
    });
    expect(response.body.affectedSections).toEqual(expect.arrayContaining(['FOOD_PLAN', 'SAFETY']));
    expect(response.body.reasonCodes).toContain('RESTRICTED_FOOD_IN_CURRENT_PLAN');
    expect(response.body.safetyActionsRequired).toContain('REVIEW_AFFECTED_MEALS');
  });

  it('flags wearable sync as low-severity plan context impact', async () => {
    const user = await registerTestUser(ctx.app);
    await createPlan(user.user.id, '2026-07-08');

    const response = await request(ctx.app.getHttpServer())
      .post('/v1/plan-impact/evaluate')
      .set(authHeader(user.accessToken))
      .send({
        changeTypes: ['APPLE_HEALTH_SYNCED'],
        localDate: '2026-07-08'
      })
      .expect(201);

    expect(response.body).toMatchObject({
      affectsCurrentPlan: true,
      severity: 'LOW',
      aiRegenerationRecommended: true
    });
    expect(response.body.affectedSections).toContain('WEARABLE_CONTEXT');
    expect(response.body.prompt.messageCode).toBe('USE_LATEST_HEALTH_DATA');
  });

  it('does not mutate the current plan while evaluating impact', async () => {
    const user = await registerTestUser(ctx.app);
    const plan = await createPlan(user.user.id, '2026-07-08');

    await request(ctx.app.getHttpServer())
      .post('/v1/plan-impact/evaluate')
      .set(authHeader(user.accessToken))
      .send({
        changeTypes: ['TRAINING_ROUTINE_CHANGED'],
        localDate: '2026-07-08'
      })
      .expect(201);

    const unchangedPlan = await ctx.prisma.dailyPlan.findUniqueOrThrow({
      where: { id: plan.id }
    });

    expect(unchangedPlan.updatedAt.toISOString()).toBe(plan.updatedAt.toISOString());
    expect(unchangedPlan.planJson).toEqual(plan.planJson);
  });

  async function createPlan(
    userId: string,
    planLocalDate: string,
    planJson: Record<string, unknown> = {
      nutrition: {
        meals: [
          {
            name: 'Breakfast',
            foods: [{ name: 'Oats' }]
          }
        ]
      }
    }
  ) {
    return ctx.prisma.dailyPlan.create({
      data: {
        userId,
        planLocalDate,
        planTimezone: 'UTC',
        status: PlanStatus.READY,
        readinessLevel: DailyReadinessLevel.MAINTAIN,
        planJson: planJson as Prisma.InputJsonValue
      }
    });
  }
});
