import request from 'supertest';
import { GoalImpactMode, GoalType, PrimaryGoal } from '@prisma/client';

import { cleanupDatabase } from './helpers/cleanup';
import { authHeader, registerTestUser } from './helpers/auth';
import { createTestApp, TestApp } from './helpers/test-app';
import { seedExerciseCatalog } from '../prisma/seeds/exercises/seed';

const TEST_DATE = '2026-07-08';

describe('Weight tracking', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    delete process.env.AI_PROVIDER;
    ctx = await createTestApp();
    await seedExerciseCatalog(ctx.prisma);
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

  it('requires authentication for weight endpoints', async () => {
    await request(ctx.app.getHttpServer()).get('/v1/weight/summary').expect(401);
    await request(ctx.app.getHttpServer()).get('/v1/weight/logs').expect(401);
    await request(ctx.app.getHttpServer())
      .post('/v1/weight/logs')
      .send({ weight: 80, unit: 'KG' })
      .expect(401);
  });

  it('creates a manual weight log, updates current profile weight, and returns summary', async () => {
    const user = await setupUser({ weightKg: 90, targetWeightKg: 85 });

    const created = await request(ctx.app.getHttpServer())
      .post('/v1/weight/logs')
      .set(authHeader(user.accessToken))
      .send({
        weight: 88.4,
        unit: 'KG',
        localDate: TEST_DATE,
        measuredAt: `${TEST_DATE}T08:30:00.000Z`,
        note: 'Morning check'
      })
      .expect(201);

    expect(created.body).toMatchObject({
      localDate: TEST_DATE,
      weightKg: 88.4,
      source: 'MANUAL',
      note: 'Morning check'
    });

    const profile = await ctx.prisma.profile.findUniqueOrThrow({ where: { userId: user.user.id } });
    expect(profile.weightKg).toBeCloseTo(88.4);

    const summary = await request(ctx.app.getHttpServer())
      .get('/v1/weight/summary')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(summary.body).toMatchObject({
      currentWeightKg: 88.4,
      targetWeightKg: 85,
      startingWeightKg: 88.4,
      remainingToGoalKg: 3.4,
      direction: 'LOSS',
      source: 'MANUAL',
      safetyStatus: 'OK'
    });
    expect(summary.body.lastUpdatedAt).toBe(`${TEST_DATE}T08:30:00.000Z`);
  });

  it('upserts one manual entry per local day and converts pounds to kg', async () => {
    const user = await setupUser({ weightKg: 90, targetWeightKg: 85 });

    await request(ctx.app.getHttpServer())
      .post('/v1/weight/logs')
      .set(authHeader(user.accessToken))
      .send({ weight: 198, unit: 'LB', localDate: TEST_DATE })
      .expect(201);
    await request(ctx.app.getHttpServer())
      .post('/v1/weight/logs')
      .set(authHeader(user.accessToken))
      .send({ weight: 196, unit: 'LB', localDate: TEST_DATE })
      .expect(201);

    const logs = await request(ctx.app.getHttpServer())
      .get('/v1/weight/logs')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(logs.body.items).toHaveLength(1);
    expect(logs.body.items[0].weightKg).toBeCloseTo(88.9, 1);
  });

  it('rejects invalid weight values and does not mutate profile weight', async () => {
    const user = await setupUser({ weightKg: 90 });

    await request(ctx.app.getHttpServer())
      .post('/v1/weight/logs')
      .set(authHeader(user.accessToken))
      .send({ weight: Number.POSITIVE_INFINITY, unit: 'KG', localDate: TEST_DATE })
      .expect(400);
    await request(ctx.app.getHttpServer())
      .post('/v1/weight/logs')
      .set(authHeader(user.accessToken))
      .send({ weight: 5, unit: 'KG', localDate: TEST_DATE })
      .expect(400);

    const profile = await ctx.prisma.profile.findUniqueOrThrow({ where: { userId: user.user.id } });
    expect(profile.weightKg).toBe(90);
  });

  it('uses latest weight for future nutrition targets without changing old DailyPlan snapshots', async () => {
    const user = await setupUser({ weightKg: 72, primaryGoal: PrimaryGoal.HEALTHY_EATING });
    await saveNutritionPreferences(user.accessToken);

    const before = await request(ctx.app.getHttpServer())
      .get(`/v1/nutrition-targets/preview?date=${TEST_DATE}`)
      .set(authHeader(user.accessToken))
      .expect(200);
    const generated = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: false })
      .expect(201);
    const savedTarget = generated.body.plan.nutritionTargetSnapshot.targetKcal;

    await request(ctx.app.getHttpServer())
      .post('/v1/weight/logs')
      .set(authHeader(user.accessToken))
      .send({ weight: 82, unit: 'KG', localDate: TEST_DATE })
      .expect(201);

    const after = await request(ctx.app.getHttpServer())
      .get(`/v1/nutrition-targets/preview?date=${TEST_DATE}`)
      .set(authHeader(user.accessToken))
      .expect(200);
    const today = await request(ctx.app.getHttpServer())
      .get('/v1/daily-plans/today')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(after.body.calories.maintenanceEstimateKcal).toBeGreaterThan(before.body.calories.maintenanceEstimateKcal);
    expect(today.body.plan.nutritionTargetSnapshot.targetKcal).toBe(savedTarget);
  });

  it('returns limited safety status for minors and missing profile info safely', async () => {
    const minor = await setupUser({ dateOfBirth: '2011-01-10', weightKg: 65 });
    const incomplete = await registerTestUser(ctx.app);

    const minorSummary = await request(ctx.app.getHttpServer())
      .get('/v1/weight/summary')
      .set(authHeader(minor.accessToken))
      .expect(200);
    const incompleteSummary = await request(ctx.app.getHttpServer())
      .get('/v1/weight/summary')
      .set(authHeader(incomplete.accessToken))
      .expect(200);

    expect(minorSummary.body.safetyStatus).toBe('LIMITED');
    expect(incompleteSummary.body).toMatchObject({
      currentWeightKg: null,
      targetWeightKg: null,
      direction: 'UNKNOWN',
      safetyStatus: 'NEEDS_MORE_INFO'
    });
  });

  async function setupUser(input: {
    dateOfBirth?: string;
    weightKg: number;
    targetWeightKg?: number;
    primaryGoal?: PrimaryGoal;
  }) {
    const user = await registerTestUser(ctx.app);
    const primaryGoal = input.primaryGoal ?? PrimaryGoal.WEIGHT_LOSS;

    await request(ctx.app.getHttpServer())
      .put('/v1/profile')
      .set(authHeader(user.accessToken))
      .send({
        firstName: 'Weight',
        gender: 'female',
        pregnancyStatus: 'PREFER_NOT_TO_SAY',
        dateOfBirth: input.dateOfBirth ?? '1994-05-14',
        heightCm: 170,
        weightKg: input.weightKg,
        activityLevel: 'MODERATE',
        privacyConsentAccepted: true
      })
      .expect(200);

    await request(ctx.app.getHttpServer())
      .put('/v1/goals')
      .set(authHeader(user.accessToken))
      .send({
        goalType: primaryGoal === PrimaryGoal.WEIGHT_LOSS ? GoalType.REDUCE_WEIGHT : GoalType.HEALTHY_LIFESTYLE,
        primaryGoal,
        appMode: GoalImpactMode.NUTRITION_ONLY,
        targetWeightKg: input.targetWeightKg,
        targetTimelineDays: input.targetWeightKg ? 120 : undefined
      })
      .expect(200);

    return user;
  }

  async function saveNutritionPreferences(accessToken: string) {
    await request(ctx.app.getHttpServer())
      .put('/v1/nutrition-preferences')
      .set(authHeader(accessToken))
      .send({
        dietType: 'OMNIVORE',
        mealsPerDay: 3,
        noKnownAllergiesConfirmed: true,
        allergies: [],
        excludedFoods: [],
        preferredFoods: ['rice', 'eggs']
      })
      .expect(200);
  }
});
