import request from 'supertest';
import type { DailyFoodPlan } from '@optime/shared-types';

import { dailyFoodPlanSchema } from '../src/modules/daily-plans/daily-plan-json.schema';
import { FoodPlanValidationService } from '../src/modules/nutrition-agent/food-plan-validation.service';
import { SafetyService } from '../src/modules/safety/safety.service';
import { cleanupDatabase } from './helpers/cleanup';
import { authHeader, registerTestUser } from './helpers/auth';
import { createTestApp, TestApp } from './helpers/test-app';

describe('Specialized Nutrition Agent food plans', () => {
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

  it('stores a structured foodPlan inside generated DailyPlanJson', async () => {
    const user = await registerTestUser(ctx.app, 'nutrition-agent-plan@example.com');
    await completeNutritionOnlyOnboarding(user.accessToken, {
      mealsPerDay: 4,
      preferredFoods: ['rice', 'eggs']
    });

    const response = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);

    const foodPlan = response.body.plan.nutrition.foodPlan as DailyFoodPlan;

    expect(dailyFoodPlanSchema.safeParse(foodPlan).success).toBe(true);
    expect(foodPlan.source).toBe('NUTRITION_AGENT');
    expect(foodPlan.meals).toHaveLength(4);
    expect(foodPlan.nutritionTargetSnapshot.targetKcal).toBe(
      response.body.plan.nutritionTargetSnapshot.targetKcal
    );
    expect(foodPlan.totals.caloriesKcal).toBe(
      response.body.plan.nutritionTargetSnapshot.targetKcal
    );
    expect(foodPlan.meals[0].ingredients[0]).toMatchObject({
      unit: 'serving',
      isOptional: false
    });
    expect(foodPlan.meals[0].substitutions[0].reasonCode).toBe('SIMILAR_MACROS');
  });

  it('validates foodPlan schema for meal types, ingredient quantities, and negative macros', async () => {
    const user = await registerTestUser(ctx.app, 'nutrition-agent-schema@example.com');
    await completeNutritionOnlyOnboarding(user.accessToken, {});

    const generated = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);
    const validFoodPlan = generated.body.plan.nutrition.foodPlan as DailyFoodPlan;

    expect(dailyFoodPlanSchema.safeParse(validFoodPlan).success).toBe(true);

    expect(
      dailyFoodPlanSchema.safeParse({
        ...validFoodPlan,
        meals: [{ ...validFoodPlan.meals[0], mealType: 'BRUNCH' }]
      }).success
    ).toBe(false);

    expect(
      dailyFoodPlanSchema.safeParse({
        ...validFoodPlan,
        meals: [
          {
            ...validFoodPlan.meals[0],
            ingredients: [{ ...validFoodPlan.meals[0].ingredients[0], quantity: undefined }]
          }
        ]
      }).success
    ).toBe(false);

    expect(
      dailyFoodPlanSchema.safeParse({
        ...validFoodPlan,
        meals: [{ ...validFoodPlan.meals[0], proteinGrams: -1 }]
      }).success
    ).toBe(false);
  });

  it('keeps old text-only food sections readable while new plans prefer foodPlan', async () => {
    const user = await registerTestUser(ctx.app, 'nutrition-agent-legacy@example.com');
    await completeNutritionOnlyOnboarding(user.accessToken, {});

    const generated = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);

    const legacyJson = {
      ...generated.body.plan,
      nutrition: {
        ...generated.body.plan.nutrition,
        foodPlan: undefined
      }
    };
    delete legacyJson.nutrition.foodPlan;

    await ctx.prisma.dailyPlan.update({
      where: { id: generated.body.id },
      data: { planJson: legacyJson }
    });

    const today = await request(ctx.app.getHttpServer())
      .get('/v1/daily-plans/today')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(today.body.plan.nutrition.foodPlan).toBeUndefined();
    expect(today.body.plan.nutrition.meals.length).toBeGreaterThan(0);
  });

  it('rejects invalid food-plan arithmetic and target mismatch deterministically', async () => {
    const user = await registerTestUser(ctx.app, 'nutrition-agent-validation@example.com');
    await completeNutritionOnlyOnboarding(user.accessToken, {});

    const generated = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);

    const validator = new FoodPlanValidationService();
    const foodPlan = generated.body.plan.nutrition.foodPlan as DailyFoodPlan;
    const invalidPlan = {
      ...foodPlan,
      totals: {
        ...foodPlan.totals,
        caloriesKcal: foodPlan.totals.caloriesKcal + 900
      }
    };
    const result = validator.validate(invalidPlan, {
      nutritionTarget: await getNutritionTarget(user.accessToken),
      nutritionTargetSnapshot: generated.body.plan.nutritionTargetSnapshot,
      allergies: [],
      excludedFoods: [],
      safeMode: false,
      isMinor: false
    });

    expect(result.passed).toBe(false);
    expect(result.reasons).toEqual(
      expect.arrayContaining(['DAILY_TOTALS_DO_NOT_MATCH_MEALS', 'CALORIES_OUTSIDE_TARGET_TOLERANCE'])
    );
  });

  it('blocks allergy and excluded-food conflicts inside structured foodPlan ingredients', async () => {
    const user = await registerTestUser(ctx.app, 'nutrition-agent-restricted-food@example.com');
    await completeNutritionOnlyOnboarding(user.accessToken, {
      allergies: ['avocado'],
      excludedFoods: ['pork']
    });

    const generated = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);
    const plan = generated.body.plan;

    plan.nutrition.foodPlan.meals[0].ingredients[0].name = 'Avocado toast';
    const safety = new SafetyService().validatePlanFoodSafety(plan, {
      allergies: ['avocado'],
      excludedFoods: ['pork']
    });

    expect(safety.passed).toBe(false);
    expect(safety.conflicts[0]).toMatchObject({
      conflictType: 'allergy',
      restrictedFood: 'avocado',
      matchedPath: 'nutrition.foodPlan.meals[0].ingredients[0].name'
    });
  });

  it('blocks restricted foods in structured foodPlan substitutions and preparation steps', async () => {
    const user = await registerTestUser(ctx.app, 'nutrition-agent-substitution-safety@example.com');
    await completeNutritionOnlyOnboarding(user.accessToken, {
      allergies: ['avocado'],
      excludedFoods: ['pork']
    });

    const generated = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);
    const plan = generated.body.plan;

    plan.nutrition.foodPlan.meals[0].substitutions[0].replacementItem = 'Avocado';
    expect(
      new SafetyService().validatePlanFoodSafety(plan, {
        allergies: ['avocado'],
        excludedFoods: ['pork']
      }).passed
    ).toBe(false);

    plan.nutrition.foodPlan.meals[0].substitutions[0].replacementItem = 'Greek yogurt';
    plan.nutrition.foodPlan.meals[0].preparationSteps = ['Serve with pork on the side.'];
    expect(
      new SafetyService().validatePlanFoodSafety(plan, {
        allergies: ['avocado'],
        excludedFoods: ['pork']
      }).passed
    ).toBe(false);
  });

  it('updates excluded and disliked foods through the food preferences endpoint', async () => {
    const user = await registerTestUser(ctx.app, 'food-preferences-update@example.com');
    await completeNutritionOnlyOnboarding(user.accessToken, {});

    const response = await request(ctx.app.getHttpServer())
      .patch('/v1/food-preferences')
      .set(authHeader(user.accessToken))
      .send({
        dietType: 'NONE',
        mealsPerDay: 3,
        noKnownAllergiesConfirmed: true,
        allergies: [],
        excludedFoods: ['walnuts'],
        dislikedFoods: ['mushrooms'],
        preferredFoods: ['rice']
      })
      .expect(200);

    expect(response.body.excludedFoods.map((food: { name: string }) => food.name)).toEqual(['walnuts']);
    expect(response.body.dislikedFoods.map((food: { name: string }) => food.name)).toEqual(['mushrooms']);
  });

  it('adds an excluded ingredient without changing the current food plan', async () => {
    const user = await registerTestUser(ctx.app, 'exclude-ingredient@example.com');
    await completeNutritionOnlyOnboarding(user.accessToken, {});

    const generated = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);
    const beforeFoodPlan = generated.body.plan.nutrition.foodPlan as DailyFoodPlan;
    const ingredientName = beforeFoodPlan.meals[0].ingredients[0].name;

    const response = await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${generated.body.id}/food/exclude-ingredient`)
      .set(authHeader(user.accessToken))
      .send({ ingredientName })
      .expect(201);

    expect(response.body.excludedFoods.map((food: { name: string }) => food.name)).toContain(ingredientName);

    await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${generated.body.id}/food/exclude-ingredient`)
      .set(authHeader(user.accessToken))
      .send({ ingredientName })
      .expect(201);

    const preferences = await request(ctx.app.getHttpServer())
      .get('/v1/food-preferences')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(
      preferences.body.excludedFoods.filter((food: { name: string }) => food.name === ingredientName)
    ).toHaveLength(1);

    const today = await request(ctx.app.getHttpServer())
      .get('/v1/daily-plans/today')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(today.body.plan.nutrition.foodPlan).toEqual(beforeFoodPlan);
  });

  it('regenerates the full food menu while preserving nutrition target and non-food plan sections', async () => {
    const user = await registerTestUser(ctx.app, 'full-menu-regeneration@example.com');
    await completeNutritionOnlyOnboarding(user.accessToken, {});

    const generated = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);
    const beforePlan = generated.body.plan;
    const beforeTarget = beforePlan.nutrition.foodPlan.nutritionTargetSnapshot;

    const regenerated = await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${generated.body.id}/food/regenerate`)
      .set(authHeader(user.accessToken))
      .send({ reason: 'I want a different full menu.' })
      .expect(201);

    const foodPlan = regenerated.body.plan.nutrition.foodPlan as DailyFoodPlan;
    expect(foodPlan.nutritionTargetSnapshot).toEqual(beforeTarget);
    expect(foodPlan.meals.every((meal) => meal.shortDescription?.includes('Menu refreshed'))).toBe(true);
    expect(regenerated.body.plan.training).toEqual(beforePlan.training);
    expect(regenerated.body.plan.recovery).toEqual(beforePlan.recovery);
    expect(regenerated.body.plan.reminders).toEqual(beforePlan.reminders);
  });

  it('regenerates one meal and keeps the stored nutrition target snapshot', async () => {
    const user = await registerTestUser(ctx.app, 'meal-regeneration@example.com');
    await completeNutritionOnlyOnboarding(user.accessToken, {});

    const generated = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);
    const beforeFoodPlan = generated.body.plan.nutrition.foodPlan as DailyFoodPlan;
    const selectedMealId = beforeFoodPlan.meals[0].id;

    const regenerated = await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${generated.body.id}/food/meals/${selectedMealId}/regenerate`)
      .set(authHeader(user.accessToken))
      .send({ reason: 'I do not like this meal.' })
      .expect(201);

    const foodPlan = regenerated.body.plan.nutrition.foodPlan as DailyFoodPlan;
    expect(foodPlan.nutritionTargetSnapshot).toEqual(beforeFoodPlan.nutritionTargetSnapshot);
    expect(foodPlan.meals.find((meal) => meal.id === selectedMealId)?.shortDescription).toContain('Meal refreshed');
    expect(foodPlan.meals.slice(1)).toEqual(beforeFoodPlan.meals.slice(1));
  });

  it('rejects invalid meal regeneration and old text-only plans without mutating the plan', async () => {
    const user = await registerTestUser(ctx.app, 'meal-regeneration-invalid@example.com');
    await completeNutritionOnlyOnboarding(user.accessToken, {});

    const generated = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);
    const beforeFoodPlan = generated.body.plan.nutrition.foodPlan as DailyFoodPlan;

    await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${generated.body.id}/food/meals/not-a-real-meal/regenerate`)
      .set(authHeader(user.accessToken))
      .send({ reason: 'Try another option.' })
      .expect(400);

    let today = await request(ctx.app.getHttpServer())
      .get('/v1/daily-plans/today')
      .set(authHeader(user.accessToken))
      .expect(200);
    expect(today.body.plan.nutrition.foodPlan).toEqual(beforeFoodPlan);

    const legacyJson = {
      ...today.body.plan,
      nutrition: {
        ...today.body.plan.nutrition
      }
    };
    delete legacyJson.nutrition.foodPlan;

    await ctx.prisma.dailyPlan.update({
      where: { id: generated.body.id },
      data: { planJson: legacyJson }
    });

    await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${generated.body.id}/food/regenerate`)
      .set(authHeader(user.accessToken))
      .send({ reason: 'Try another full menu.' })
      .expect(400);
  });

  async function completeNutritionOnlyOnboarding(
    token: string,
    overrides: {
      mealsPerDay?: number;
      allergies?: string[];
      excludedFoods?: string[];
      dislikedFoods?: string[];
      preferredFoods?: string[];
    }
  ) {
    await request(ctx.app.getHttpServer())
      .put('/v1/profile')
      .set(authHeader(token))
      .send({
        firstName: 'Nutrition',
        gender: 'prefer_not_to_say',
        dateOfBirth: '1990-01-01',
        heightCm: 178,
        weightKg: 78,
        activityLevel: 'MODERATE',
        privacyConsentAccepted: true
      })
      .expect(200);

    await request(ctx.app.getHttpServer())
      .put('/v1/goals')
      .set(authHeader(token))
      .send({
        primaryGoal: 'HEALTHY_EATING',
        appMode: 'NUTRITION_ONLY'
      })
      .expect(200);

    await request(ctx.app.getHttpServer())
      .put('/v1/nutrition-preferences')
      .set(authHeader(token))
      .send({
        dietType: 'NONE',
        mealsPerDay: overrides.mealsPerDay ?? 3,
        noKnownAllergiesConfirmed: !overrides.allergies?.length,
        allergies: overrides.allergies ?? [],
        excludedFoods: overrides.excludedFoods ?? [],
        dislikedFoods: overrides.dislikedFoods ?? [],
        preferredFoods: overrides.preferredFoods ?? ['oats', 'chicken']
      })
      .expect(200);
  }

  async function getNutritionTarget(token: string) {
    const response = await request(ctx.app.getHttpServer())
      .get('/v1/nutrition-targets/preview')
      .set(authHeader(token))
      .expect(200);

    return response.body;
  }
});
