import request from 'supertest';
import { GoalImpactMode, GoalType, PrimaryGoal } from '@prisma/client';

import { cleanupDatabase } from './helpers/cleanup';
import { authHeader, registerTestUser } from './helpers/auth';
import { createTestApp, TestApp } from './helpers/test-app';
import { seedExerciseCatalog } from '../prisma/seeds/exercises/seed';

const TEST_DATE = '2026-06-29';

describe('Deterministic nutrition targets', () => {
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

  it('requires authentication for nutrition target preview', async () => {
    await request(ctx.app.getHttpServer())
      .get(`/v1/nutrition-targets/preview?date=${TEST_DATE}`)
      .expect(401);
  });

  it('returns NEEDS_MORE_INFO instead of fake targets when profile basics are missing', async () => {
    const user = await registerTestUser(ctx.app);

    const response = await request(ctx.app.getHttpServer())
      .get(`/v1/nutrition-targets/preview?date=${TEST_DATE}`)
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(response.body.safety.status).toBe('NEEDS_MORE_INFO');
    expect(response.body.calories.targetKcal).toBe(0);
    expect(response.body.macros.proteinGrams).toBe(0);
    expect(response.body.explanation).toMatchObject({
      titleCode: 'MORE_INFO_NEEDED',
      reasonCodes: [
        {
          code: 'NEEDS_PROFILE_DETAILS',
          params: { missingFields: ['profile'] }
        }
      ]
    });
    expect(response.body.explanation.bullets).toBeUndefined();
  });

  it('calculates nutrition-only targets without training-day energy', async () => {
    const user = await setupUser({
      impactMode: GoalImpactMode.NUTRITION_ONLY,
      primaryGoal: PrimaryGoal.WEIGHT_MAINTENANCE
    });

    const response = await request(ctx.app.getHttpServer())
      .get(`/v1/nutrition-targets/preview?date=${TEST_DATE}`)
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(response.body.appMode).toBe('NUTRITION_ONLY');
    expect(response.body.dayType).toBe('NUTRITION_ONLY');
    expect(response.body.context.trainingEnabled).toBe(false);
    expect(response.body.context.plannedWorkoutDurationMinutes).toBeNull();
    expect(response.body.calories.adjustmentKcal).toBe(0);
    expect(response.body.explanation.reasonCodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'NUTRITION_ONLY_MODE' })
      ])
    );
  });

  it('adds modest workout support on training days and omits it on scheduled rest days', async () => {
    const user = await setupUser({
      impactMode: GoalImpactMode.NUTRITION_AND_TRAINING,
      primaryGoal: PrimaryGoal.WEIGHT_MAINTENANCE
    });
    await saveWeeklySchedule(user.accessToken, true);

    const trainingDay = await request(ctx.app.getHttpServer())
      .get(`/v1/nutrition-targets/preview?date=2026-06-29`)
      .set(authHeader(user.accessToken))
      .expect(200);
    const restDay = await request(ctx.app.getHttpServer())
      .get(`/v1/nutrition-targets/preview?date=2026-06-30`)
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(trainingDay.body.dayType).toBe('TRAINING_DAY');
    expect(trainingDay.body.context.plannedWorkoutDurationMinutes).toBe(45);
    expect(trainingDay.body.calories.targetKcal).toBeGreaterThan(restDay.body.calories.targetKcal);
    expect(trainingDay.body.explanation.reasonCodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'ADJUSTED_FOR_TRAINING_DAY',
          params: expect.objectContaining({ durationMinutes: 45 })
        })
      ])
    );
    expect(restDay.body.dayType).toBe('REST_DAY');
    expect(restDay.body.context.plannedWorkoutDurationMinutes).toBeNull();
    expect(restDay.body.explanation.reasonCodes).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'SCHEDULED_REST_DAY' })])
    );
  });

  it('keeps under-18 weight-loss targets conservative and LIMITED', async () => {
    const user = await setupUser({
      dateOfBirth: '2011-01-10',
      impactMode: GoalImpactMode.NUTRITION_ONLY,
      primaryGoal: PrimaryGoal.WEIGHT_LOSS,
      targetWeightKg: 60,
      targetTimelineDays: 60
    });

    const response = await request(ctx.app.getHttpServer())
      .get(`/v1/nutrition-targets/preview?date=${TEST_DATE}`)
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(response.body.safety.status).toBe('LIMITED');
    expect(response.body.calories.adjustmentKcal).toBeGreaterThanOrEqual(0);
    expect(response.body.explanation.reasonCodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'LIMITED_BY_HEALTH_CONTEXT' }),
        expect.objectContaining({ code: 'CONSERVATIVE_SAFETY_TARGET' })
      ])
    );
  });

  it('stores an immutable nutrition target snapshot in generated DailyPlanJson', async () => {
    const user = await setupUser({
      impactMode: GoalImpactMode.NUTRITION_ONLY,
      primaryGoal: PrimaryGoal.HEALTHY_EATING
    });
    await saveNutritionPreferences(user.accessToken);

    const generated = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: false })
      .expect(201);

    expect(generated.body.plan.nutritionTargetSnapshot).toMatchObject({
      engineVersion: 1,
      dayType: 'NUTRITION_ONLY',
      appMode: 'NUTRITION_ONLY',
      primaryGoal: 'HEALTHY_EATING'
    });
    expect(generated.body.plan.nutritionTargetSnapshot.targetKcal).toBeGreaterThan(0);
    expect(generated.body.plan.nutritionTargetSnapshot.explanation).toMatchObject({
      titleCode: 'TODAY_TARGET',
      reasonCodes: expect.arrayContaining([
        expect.objectContaining({ code: 'HEALTHY_EATING_BALANCED_TARGET' })
      ])
    });
    expect(generated.body.plan.nutritionTargetSnapshot.explanation.bullets).toBeUndefined();

    const stored = await ctx.prisma.dailyPlan.findUniqueOrThrow({
      where: { id: generated.body.id }
    });
    expect(stored.planJson).toEqual(
      expect.objectContaining({
        nutritionTargetSnapshot: expect.objectContaining({
          engineVersion: 1,
          dayType: 'NUTRITION_ONLY'
        })
      })
    );
  });

  it('returns old DailyPlan snapshots with legacy explanation bullets without crashing', async () => {
    const user = await setupUser({
      impactMode: GoalImpactMode.NUTRITION_ONLY,
      primaryGoal: PrimaryGoal.HEALTHY_EATING
    });
    await saveNutritionPreferences(user.accessToken);

    const generated = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: false })
      .expect(201);
    const legacyPlanJson = {
      ...generated.body.plan,
      nutritionTargetSnapshot: {
        ...generated.body.plan.nutritionTargetSnapshot,
        explanation: {
          title: 'Legacy title',
          bullets: ['Legacy bullet']
        }
      }
    };

    await ctx.prisma.dailyPlan.update({
      where: { id: generated.body.id },
      data: { planJson: legacyPlanJson }
    });

    const today = await request(ctx.app.getHttpServer())
      .get('/v1/daily-plans/today')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(today.body.plan.nutritionTargetSnapshot.explanation).toEqual({
      title: 'Legacy title',
      bullets: ['Legacy bullet']
    });
  });

  async function setupUser(input: {
    dateOfBirth?: string;
    impactMode: GoalImpactMode;
    primaryGoal: PrimaryGoal;
    targetWeightKg?: number;
    targetTimelineDays?: number;
  }) {
    const user = await registerTestUser(ctx.app);
    await request(ctx.app.getHttpServer())
      .put('/v1/profile')
      .set(authHeader(user.accessToken))
      .send({
        firstName: 'Target',
        gender: 'female',
        pregnancyStatus: 'PREFER_NOT_TO_SAY',
        dateOfBirth: input.dateOfBirth ?? '1994-05-14',
        heightCm: 170,
        weightKg: 72,
        activityLevel: 'MODERATE',
        privacyConsentAccepted: true
      })
      .expect(200);

    await request(ctx.app.getHttpServer())
      .put('/v1/goals')
      .set(authHeader(user.accessToken))
      .send({
        goalType: input.primaryGoal === PrimaryGoal.WEIGHT_LOSS
          ? GoalType.REDUCE_WEIGHT
          : GoalType.HEALTHY_LIFESTYLE,
        primaryGoal: input.primaryGoal,
        appMode: input.impactMode,
        targetWeightKg: input.targetWeightKg,
        targetTimelineDays: input.targetTimelineDays
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

  async function saveWeeklySchedule(accessToken: string, mondayTraining: boolean) {
    await request(ctx.app.getHttpServer())
      .put('/v1/training-schedule')
      .set(authHeader(accessToken))
      .send({
        isActive: true,
        days: [
          createDay('MONDAY', mondayTraining, 45),
          createDay('TUESDAY', false, 30),
          createDay('WEDNESDAY', false, 30),
          createDay('THURSDAY', false, 30),
          createDay('FRIDAY', false, 30),
          createDay('SATURDAY', false, 30),
          createDay('SUNDAY', false, 30)
        ]
      })
      .expect(200);
  }

  function createDay(dayOfWeek: string, isTrainingDay: boolean, durationMinutes: number) {
    return {
      dayOfWeek,
      isTrainingDay,
      targetMusclesMode: 'USE_DEFAULT',
      targetMuscles: [],
      environmentMode: 'USE_DEFAULT',
      equipmentMode: 'USE_DEFAULT',
      availableEquipment: [],
      durationMode: 'CUSTOM',
      durationMinutes,
      protocolMode: 'USE_DEFAULT',
      protocolPreference: null
    };
  }
});
