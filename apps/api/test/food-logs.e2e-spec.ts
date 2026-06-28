import request from 'supertest';
import { Prisma } from '@prisma/client';
import type { DailyFoodPlan } from '@optime/shared-types';

import { cleanupDatabase } from './helpers/cleanup';
import { authHeader, registerTestUser } from './helpers/auth';
import { createTestApp, TestApp } from './helpers/test-app';

describe('Food meal completion tracking', () => {
  let ctx: TestApp;
  const previousAiProvider = process.env.AI_PROVIDER;

  beforeAll(async () => {
    delete process.env.AI_PROVIDER;
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await cleanupDatabase(ctx.prisma);
  });

  afterAll(async () => {
    await cleanupDatabase(ctx.prisma);
    await ctx.app.close();
    if (previousAiProvider) {
      process.env.AI_PROVIDER = previousAiProvider;
    } else {
      delete process.env.AI_PROVIDER;
    }
  });

  it('returns planned meal progress without creating a persistent log', async () => {
    const user = await registerTestUser(ctx.app, 'food-log-planned@example.com');
    const plan = await generateStructuredPlan(user.accessToken);

    const response = await request(ctx.app.getHttpServer())
      .get(`/v1/daily-plans/${plan.id}/food-log`)
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(response.body).toMatchObject({
      id: null,
      dailyPlanId: plan.id,
      supported: true,
      completedMealCount: 0,
      partialMealCount: 0,
      skippedMealCount: 0,
      markedMealCount: 0
    });
    expect(response.body.mealProgress).toHaveLength(plan.foodPlan.meals.length);
    expect(response.body.mealProgress[0]).toMatchObject({
      mealId: plan.foodPlan.meals[0].id,
      status: 'PLANNED'
    });
    expect(await ctx.prisma.foodDayLog.count()).toBe(0);
  });

  it('creates and updates one persisted status record per meal', async () => {
    const user = await registerTestUser(ctx.app, 'food-log-status@example.com');
    const plan = await generateStructuredPlan(user.accessToken);
    const mealId = plan.foodPlan.meals[0].id;

    const eaten = await updateStatus(user.accessToken, plan.id, mealId, 'EATEN');
    expect(eaten.body).toMatchObject({
      completedMealCount: 1,
      partialMealCount: 0,
      skippedMealCount: 0,
      markedMealCount: 1
    });

    const partial = await updateStatus(user.accessToken, plan.id, mealId, 'PARTIALLY_EATEN');
    expect(partial.body).toMatchObject({
      completedMealCount: 0,
      partialMealCount: 1,
      skippedMealCount: 0,
      markedMealCount: 1
    });

    const skipped = await updateStatus(user.accessToken, plan.id, mealId, 'SKIPPED');
    expect(skipped.body).toMatchObject({
      completedMealCount: 0,
      partialMealCount: 0,
      skippedMealCount: 1,
      markedMealCount: 1
    });

    const planned = await updateStatus(user.accessToken, plan.id, mealId, 'PLANNED');
    expect(planned.body).toMatchObject({
      completedMealCount: 0,
      partialMealCount: 0,
      skippedMealCount: 0,
      markedMealCount: 0
    });
    expect(await ctx.prisma.foodMealProgress.count()).toBe(plan.foodPlan.meals.length);
  });

  it('rejects invalid meals and text-only plans safely', async () => {
    const user = await registerTestUser(ctx.app, 'food-log-invalid@example.com');
    const plan = await generateStructuredPlan(user.accessToken);

    await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${plan.id}/food-log/meals/not-a-meal/status`)
      .set(authHeader(user.accessToken))
      .send({ status: 'EATEN' })
      .expect(400);

    const legacyPlan = {
      ...plan.planJson,
      nutrition: { ...plan.planJson.nutrition }
    };
    delete legacyPlan.nutrition.foodPlan;

    await ctx.prisma.dailyPlan.update({
      where: { id: plan.id },
      data: { planJson: legacyPlan as Prisma.InputJsonValue }
    });

    const unsupported = await request(ctx.app.getHttpServer())
      .get(`/v1/daily-plans/${plan.id}/food-log`)
      .set(authHeader(user.accessToken))
      .expect(200);
    expect(unsupported.body).toMatchObject({
      supported: false,
      unsupportedReason: 'NO_STRUCTURED_FOOD_PLAN'
    });

    await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${plan.id}/food-log/meals/${plan.foodPlan.meals[0].id}/status`)
      .set(authHeader(user.accessToken))
      .send({ status: 'EATEN' })
      .expect(400);
  });

  it('keeps food logs scoped to the owning user', async () => {
    const owner = await registerTestUser(ctx.app, 'food-log-owner@example.com');
    const other = await registerTestUser(ctx.app, 'food-log-other@example.com');
    const plan = await generateStructuredPlan(owner.accessToken);

    await request(ctx.app.getHttpServer())
      .get(`/v1/daily-plans/${plan.id}/food-log`)
      .set(authHeader(other.accessToken))
      .expect(404);

    await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${plan.id}/food-log/meals/${plan.foodPlan.meals[0].id}/status`)
      .set(authHeader(other.accessToken))
      .send({ status: 'EATEN' })
      .expect(404);
  });

  it('syncs progress with regenerated meal ids while preserving matching ids', async () => {
    const user = await registerTestUser(ctx.app, 'food-log-sync@example.com');
    const plan = await generateStructuredPlan(user.accessToken);
    const firstMeal = plan.foodPlan.meals[0];
    const secondMeal = plan.foodPlan.meals[1];

    await updateStatus(user.accessToken, plan.id, firstMeal.id, 'EATEN');
    await updateStatus(user.accessToken, plan.id, secondMeal.id, 'SKIPPED');

    const nextFoodPlan: DailyFoodPlan = {
      ...plan.foodPlan,
      meals: [
        { ...firstMeal, title: `${firstMeal.title} updated` },
        { ...secondMeal, id: 'replacement-meal-id', title: 'Replacement meal' }
      ]
    };
    const nextPlanJson = {
      ...plan.planJson,
      nutrition: {
        ...plan.planJson.nutrition,
        foodPlan: nextFoodPlan
      }
    };
    await ctx.prisma.dailyPlan.update({
      where: { id: plan.id },
      data: { planJson: nextPlanJson as Prisma.InputJsonValue }
    });

    const synced = await request(ctx.app.getHttpServer())
      .get(`/v1/daily-plans/${plan.id}/food-log`)
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(synced.body.mealProgress).toHaveLength(2);
    expect(synced.body.mealProgress.find((meal: { mealId: string }) => meal.mealId === firstMeal.id)).toMatchObject({
      status: 'EATEN',
      mealTitleSnapshot: `${firstMeal.title} updated`
    });
    expect(synced.body.mealProgress.find((meal: { mealId: string }) => meal.mealId === 'replacement-meal-id')).toMatchObject({
      status: 'PLANNED',
      mealTitleSnapshot: 'Replacement meal'
    });
    expect(synced.body).toMatchObject({
      plannedMealCount: 2,
      completedMealCount: 1,
      skippedMealCount: 0,
      markedMealCount: 1
    });
  });

  async function generateStructuredPlan(accessToken: string) {
    await completeNutritionOnlyOnboarding(accessToken);
    const response = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(accessToken))
      .send({ forceRegenerate: true })
      .expect(201);

    const foodPlan = response.body.plan.nutrition.foodPlan as DailyFoodPlan;
    expect(foodPlan.meals.length).toBeGreaterThanOrEqual(2);
    return {
      id: response.body.id as string,
      planJson: response.body.plan,
      foodPlan
    };
  }

  async function updateStatus(
    accessToken: string,
    dailyPlanId: string,
    mealId: string,
    status: 'PLANNED' | 'EATEN' | 'PARTIALLY_EATEN' | 'SKIPPED'
  ) {
    return request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${dailyPlanId}/food-log/meals/${mealId}/status`)
      .set(authHeader(accessToken))
      .send({ status })
      .expect(201);
  }

  async function completeNutritionOnlyOnboarding(token: string) {
    const headers = authHeader(token);
    await request(ctx.app.getHttpServer()).put('/v1/profile').set(headers).send({
      firstName: 'Food',
      gender: 'prefer_not_to_say',
      dateOfBirth: '1990-01-01',
      heightCm: 178,
      weightKg: 78,
      activityLevel: 'MODERATE',
      privacyConsentAccepted: true
    }).expect(200);

    await request(ctx.app.getHttpServer()).put('/v1/goals').set(headers).send({
      primaryGoal: 'HEALTHY_EATING',
      appMode: 'NUTRITION_ONLY'
    }).expect(200);

    await request(ctx.app.getHttpServer()).put('/v1/nutrition-preferences').set(headers).send({
      dietType: 'NONE',
      mealsPerDay: 3,
      noKnownAllergiesConfirmed: true,
      allergies: [],
      excludedFoods: [],
      dislikedFoods: [],
      preferredFoods: ['rice']
    }).expect(200);
  }
});
