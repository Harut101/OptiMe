import request from 'supertest';

import { AI_PROVIDER } from '../src/modules/ai/ai-provider.token';
import { OPENAI_CLIENT_FACTORY } from '../src/modules/ai/open-ai-client.factory';
import { normalizeDailyPlanFoodNames } from '../src/modules/daily-plans/daily-plan-food-name-normalizer';
import { dailyPlanJsonSchema } from '../src/modules/daily-plans/daily-plan-json.schema';
import { createMockDailyPlan } from '../src/modules/daily-plans/templates/mock-daily-plan.factory';
import { SafetyService } from '../src/modules/safety/safety.service';
import { SafetyAgent } from '../src/modules/safety-agent/safety-agent.interface';
import { safetyAgentReviewSchema } from '../src/modules/safety-agent/safety-agent-review.schema';
import {
  SAFETY_AGENT,
  SAFETY_AGENT_CONFIG,
  SafetyAgentConfig
} from '../src/modules/safety-agent/safety-agent.token';
import { cleanupDatabase } from './helpers/cleanup';
import { authHeader, registerTestUser } from './helpers/auth';
import { createTestApp, TestApp } from './helpers/test-app';

describe('Sprint 1 backend vertical slice', () => {
  let ctx: TestApp;
  const originalAiProvider = process.env.AI_PROVIDER;
  const originalOpenAiApiKey = process.env.OPENAI_API_KEY;
  const originalOpenAiDefaultModel = process.env.OPENAI_DEFAULT_MODEL;
  const originalOpenAiRequestTimeoutMs = process.env.OPENAI_REQUEST_TIMEOUT_MS;
  const originalOpenAiMaxOutputTokens = process.env.OPENAI_MAX_OUTPUT_TOKENS;
  const originalSafetyAgentEnabled = process.env.SAFETY_AGENT_ENABLED;
  const originalSafetyAgentProvider = process.env.SAFETY_AGENT_PROVIDER;

  beforeAll(async () => {
    delete process.env.AI_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    delete process.env.SAFETY_AGENT_ENABLED;
    delete process.env.SAFETY_AGENT_PROVIDER;
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

    restoreOpenAiEnv(
      originalAiProvider,
      originalOpenAiApiKey,
      originalOpenAiDefaultModel,
      originalOpenAiRequestTimeoutMs,
      originalOpenAiMaxOutputTokens
    );
    restoreSafetyAgentEnv(originalSafetyAgentEnabled, originalSafetyAgentProvider);
  });

  it('registers, logs in, and returns the authenticated user without passwordHash', async () => {
    const registered = await registerTestUser(ctx.app);

    expect(registered.accessToken).toBeTruthy();
    expect(registered.user.passwordHash).toBeUndefined();

    const login = await request(ctx.app.getHttpServer())
      .post('/v1/auth/login')
      .send({
        email: registered.email,
        password: 'password123'
      })
      .expect(201);

    expect(login.body.accessToken).toBeTruthy();
    expect(login.body.user.passwordHash).toBeUndefined();

    const me = await request(ctx.app.getHttpServer())
      .get('/v1/me')
      .set(authHeader(login.body.accessToken))
      .expect(200);

    expect(me.body.email).toBe(registered.email);
    expect(me.body.passwordHash).toBeUndefined();
  });

  it('derives isMinor and safeMode from dateOfBirth and rejects client safeMode', async () => {
    const user = await registerTestUser(ctx.app);

    await request(ctx.app.getHttpServer())
      .put('/v1/profile')
      .set(authHeader(user.accessToken))
      .send({
        firstName: 'Minor',
        dateOfBirth: '2012-01-01',
        heightCm: 150,
        weightKg: 45,
        activityLevel: 'MODERATE',
        safeMode: false
      })
      .expect(400);

    const profile = await request(ctx.app.getHttpServer())
      .put('/v1/profile')
      .set(authHeader(user.accessToken))
      .send({
        firstName: 'Minor',
        dateOfBirth: '2012-01-01',
        heightCm: 150,
        weightKg: 45,
        activityLevel: 'MODERATE',
        privacyConsentAccepted: true
      })
      .expect(200);

    expect(profile.body.user.isMinor).toBe(true);
    expect(profile.body.user.safeMode).toBe(true);
  });

  it('saves goals, nutrition preferences, training schedule, and onboarding status', async () => {
    const user = await registerTestUser(ctx.app);

    await completeRequiredOnboarding(ctx.app, user.accessToken);

    const status = await request(ctx.app.getHttpServer())
      .get('/v1/onboarding/status')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(status.body).toEqual({
      profileCompleted: true,
      goalCompleted: true,
      nutritionPreferencesCompleted: true,
      trainingScheduleCompleted: true,
      privacyConsentCompleted: true,
      canGeneratePlan: true
    });
  });

  it('supports training schedule CRUD for the authenticated user', async () => {
    const user = await registerTestUser(ctx.app);

    const created = await request(ctx.app.getHttpServer())
      .post('/v1/training-schedule/items')
      .set(authHeader(user.accessToken))
      .send({
        dayOfWeek: 1,
        localTime: '07:30',
        sportType: 'RUNNING',
        durationMinutes: 30,
        intensity: 'MODERATE',
        description: 'Easy run'
      })
      .expect(201);

    const listed = await request(ctx.app.getHttpServer())
      .get('/v1/training-schedule')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(listed.body).toHaveLength(1);

    const updated = await request(ctx.app.getHttpServer())
      .patch(`/v1/training-schedule/items/${created.body.id}`)
      .set(authHeader(user.accessToken))
      .send({ durationMinutes: 40 })
      .expect(200);

    expect(updated.body.durationMinutes).toBe(40);

    await request(ctx.app.getHttpServer())
      .delete(`/v1/training-schedule/items/${created.body.id}`)
      .set(authHeader(user.accessToken))
      .expect(200);

    const afterDelete = await request(ctx.app.getHttpServer())
      .get('/v1/training-schedule')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(afterDelete.body).toHaveLength(0);
  });

  it('persists mock daily plans and handles regeneration rules', async () => {
    const user = await registerTestUser(ctx.app);
    await completeRequiredOnboarding(ctx.app, user.accessToken, 'First');

    const first = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: false })
      .expect(201);

    const stored = await ctx.prisma.dailyPlan.findUniqueOrThrow({
      where: {
        userId_planLocalDate_planTimezone: {
          userId: user.user.id,
          planLocalDate: first.body.planLocalDate,
          planTimezone: first.body.planTimezone
        }
      }
    });

    expect(stored.planJson).toBeTruthy();
    expect(first.body.id).toBe(stored.id);
    expect(dailyPlanJsonSchema.safeParse(first.body.plan).success).toBe(true);
    expect(first.body).toMatchObject({
      id: stored.id,
      status: 'READY',
      readinessLevel: 'MAINTAIN',
      planLocalDate: expect.any(String),
      planTimezone: expect.any(String),
      updatedAt: expect.any(String)
    });

    const today = await request(ctx.app.getHttpServer())
      .get('/v1/daily-plans/today')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(today.body.id).toBe(first.body.id);
    expect(dailyPlanJsonSchema.safeParse(today.body.plan).success).toBe(true);

    await request(ctx.app.getHttpServer())
      .put('/v1/profile')
      .set(authHeader(user.accessToken))
      .send({
        firstName: 'Second',
        dateOfBirth: '1990-01-01',
        heightCm: 180,
        weightKg: 80,
        activityLevel: 'MODERATE',
        privacyConsentAccepted: true
      })
      .expect(200);

    const noRegenerate = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: false })
      .expect(201);

    expect(noRegenerate.body.id).toBe(first.body.id);
    expect(JSON.stringify(noRegenerate.body.plan)).toContain('First');

    const regenerated = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);

    expect(regenerated.body.id).toBe(first.body.id);
    expect(JSON.stringify(regenerated.body.plan)).toContain('Second');
  });

  it('converts under-18 weight-loss goals to a safe wellness goal', async () => {
    const user = await registerTestUser(ctx.app);

    await request(ctx.app.getHttpServer())
      .put('/v1/profile')
      .set(authHeader(user.accessToken))
      .send({
        firstName: 'Young',
        dateOfBirth: '2012-01-01',
        heightCm: 150,
        weightKg: 50,
        activityLevel: 'MODERATE',
        privacyConsentAccepted: true
      })
      .expect(200);

    const goal = await request(ctx.app.getHttpServer())
      .put('/v1/goals')
      .set(authHeader(user.accessToken))
      .send({
        goalType: 'REDUCE_WEIGHT',
        targetWeightKg: 45,
        targetTimelineDays: 30,
        impactMode: 'NUTRITION_AND_TRAINING'
      })
      .expect(200);

    expect(goal.body.goalType).toBe('HEALTHY_LIFESTYLE');
    expect(goal.body.targetWeightKg).toBeNull();
    expect(goal.body.targetTimelineDays).toBeNull();
    expect(goal.body.impactMode).toBeNull();
  });

  it('rejects aggressive adult weight-loss goals with supportive validation', async () => {
    const user = await registerTestUser(ctx.app);

    await request(ctx.app.getHttpServer())
      .put('/v1/profile')
      .set(authHeader(user.accessToken))
      .send({
        firstName: 'Adult',
        dateOfBirth: '1990-01-01',
        heightCm: 180,
        weightKg: 90,
        activityLevel: 'MODERATE',
        privacyConsentAccepted: true
      })
      .expect(200);

    const response = await request(ctx.app.getHttpServer())
      .put('/v1/goals')
      .set(authHeader(user.accessToken))
      .send({
        goalType: 'REDUCE_WEIGHT',
        targetWeightKg: 80,
        targetTimelineDays: 60,
        impactMode: 'NUTRITION_AND_TRAINING'
      })
      .expect(400);

    expect(response.body.message).toContain('steadier goal');
  });

  it('allows steady adult weight-loss goals within safety boundaries', async () => {
    const user = await registerTestUser(ctx.app);

    await request(ctx.app.getHttpServer())
      .put('/v1/profile')
      .set(authHeader(user.accessToken))
      .send({
        firstName: 'Adult',
        dateOfBirth: '1990-01-01',
        heightCm: 180,
        weightKg: 90,
        activityLevel: 'MODERATE',
        privacyConsentAccepted: true
      })
      .expect(200);

    const response = await request(ctx.app.getHttpServer())
      .put('/v1/goals')
      .set(authHeader(user.accessToken))
      .send({
        goalType: 'REDUCE_WEIGHT',
        targetWeightKg: 85,
        targetTimelineDays: 60,
        impactMode: 'NUTRITION_AND_TRAINING'
      })
      .expect(200);

    expect(response.body.goalType).toBe('REDUCE_WEIGHT');
    expect(response.body.targetWeightKg).toBe(85);
    expect(response.body.targetTimelineDays).toBe(60);
  });

  it('rejects nutrition preferences when preferred foods conflict with allergies or exclusions', async () => {
    const user = await registerTestUser(ctx.app);

    const response = await request(ctx.app.getHttpServer())
      .put('/v1/nutrition-preferences')
      .set(authHeader(user.accessToken))
      .send({
        dietType: 'NONE',
        mealsPerDay: 3,
        allergies: ['peanuts'],
        excludedFoods: ['shellfish'],
        preferredFoods: ['Peanuts']
      })
      .expect(400);

    expect(response.body.message).toContain('Preferred foods cannot include allergies');
  });

  it('rejects unsafe training duration and high intensity through symptoms', async () => {
    const user = await registerTestUser(ctx.app);

    await request(ctx.app.getHttpServer())
      .post('/v1/training-schedule/items')
      .set(authHeader(user.accessToken))
      .send({
        dayOfWeek: 1,
        localTime: '07:30',
        sportType: 'HIIT',
        durationMinutes: 150,
        intensity: 'HIGH',
        description: 'Hard session'
      })
      .expect(400);

    const response = await request(ctx.app.getHttpServer())
      .post('/v1/training-schedule/items')
      .set(authHeader(user.accessToken))
      .send({
        dayOfWeek: 2,
        localTime: '07:30',
        sportType: 'RUNNING',
        durationMinutes: 30,
        intensity: 'HIGH',
        description: 'Push hard even with dizziness'
      })
      .expect(400);

    expect(response.body.message).toContain('pain, illness, dizziness, or exhaustion');
  });

  it('detects restricted foods in notes by local phrase instead of whole sentence', () => {
    const safetyService = new SafetyService();
    const buildPlanWithNote = (note: string) => {
      const plan = createMockDailyPlan({
        planLocalDate: getUtcLocalDate(),
        planTimezone: 'UTC',
        firstName: 'FoodSafety',
        isMinor: false
      });

      plan.nutrition.meals[0].foods[0].name = 'Chicken bowl';
      plan.nutrition.meals[0].foods[0].notes = note;
      plan.reminders = [];

      return plan;
    };

    for (const note of [
      'Add variety and fiber, avoiding avocado.',
      'Choose vegetables, avoiding avocado.',
      'Avoid avocado.',
      'Without avocado.',
      'No avocado.',
      'Avocado-free option.',
      'This meal avoids your allergy: avocado.'
    ]) {
      expect(
        safetyService.validatePlanFoodSafety(buildPlanWithNote(note), {
          allergies: ['avocado'],
          excludedFoods: []
        }).passed
      ).toBe(true);
    }

    for (const note of [
      'Add avocado.',
      'Add sliced avocado.',
      'Serve with avocado.',
      'Top with avocado.',
      'Include avocado.',
      'Use avocado as a side.',
      'Pair with avocado.',
      'Mix in avocado.',
      'Avocado toast.',
      'Salad with avocado.'
    ]) {
      expect(
        safetyService.validatePlanFoodSafety(buildPlanWithNote(note), {
          allergies: ['avocado'],
          excludedFoods: []
        }).passed
      ).toBe(false);
    }

    const foodNamePlan = buildPlanWithNote('Simple and balanced.');
    foodNamePlan.nutrition.meals[0].foods[0].name = 'Avocado toast';

    expect(
      safetyService.validatePlanFoodSafety(foodNamePlan, {
        allergies: ['avocado'],
        excludedFoods: []
      }).passed
    ).toBe(false);
  });

  it('normalizes safe avoidance qualifiers out of food names before safety checks', () => {
    const buildPlanWithFoodName = (name: string) => {
      const plan = createMockDailyPlan({
        planLocalDate: getUtcLocalDate(),
        planTimezone: 'UTC',
        firstName: 'FoodNameSafety',
        isMinor: false
      });

      plan.nutrition.meals[0].foods[0].name = name;
      plan.nutrition.meals[0].foods[0].notes = 'Simple and balanced.';

      return plan;
    };

    for (const [inputName, expectedName] of [
      ['Mixed salad (no avocado, no broccoli)', 'Mixed salad'],
      ['Salad without avocado', 'Salad'],
      ['No-avocado salad', 'Salad'],
      ['Avocado-free salad', 'Salad']
    ] as const) {
      const result = normalizeDailyPlanFoodNames(buildPlanWithFoodName(inputName), {
        allergies: ['avocado'],
        excludedFoods: ['broccoli']
      });

      expect(result.normalizedPaths).toContain('nutrition.meals[0].foods[0].name');
      expect(result.planJson.nutrition.meals[0].foods[0].name).toBe(expectedName);
      expect(result.planJson.nutrition.meals[0].foods[0].notes).toContain('Prepared without');
      expect(
        new SafetyService().validatePlanFoodSafety(result.planJson, {
          allergies: ['avocado'],
          excludedFoods: ['broccoli']
        }).passed
      ).toBe(true);
    }

    for (const inputName of ['Avocado toast', 'Chicken with avocado', 'Salad with avocado']) {
      const result = normalizeDailyPlanFoodNames(buildPlanWithFoodName(inputName), {
        allergies: ['avocado'],
        excludedFoods: []
      });

      expect(result.normalizedPaths).toHaveLength(0);
      expect(
        new SafetyService().validatePlanFoodSafety(result.planJson, {
          allergies: ['avocado'],
          excludedFoods: []
        }).passed
      ).toBe(false);
    }
  });

  it('persists a safe fallback plan if generated foods conflict with allergies', async () => {
    const user = await registerTestUser(ctx.app);
    await completeRequiredOnboarding(ctx.app, user.accessToken, 'Fallback');

    await request(ctx.app.getHttpServer())
      .put('/v1/nutrition-preferences')
      .set(authHeader(user.accessToken))
      .send({
        dietType: 'NONE',
        mealsPerDay: 3,
        allergies: ['Greek yogurt'],
        excludedFoods: [],
        preferredFoods: ['rice']
      })
      .expect(200);

    const plan = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);

    expect(plan.body.status).toBe('FALLBACK');
    expect(dailyPlanJsonSchema.safeParse(plan.body.plan).success).toBe(true);
    expect(plan.body.plan.schemaVersion).toBe('sprint-2.v1');
    expect(JSON.stringify(plan.body.plan)).not.toContain('Greek yogurt');
    expect(JSON.stringify(plan.body.plan)).toContain('conflicts with your allergies');
  });

  it('normalizes old Sprint 1 plan JSON without crashing the response', async () => {
    const user = await registerTestUser(ctx.app);
    await completeRequiredOnboarding(ctx.app, user.accessToken, 'Legacy');
    const legacyLocalDate = getUtcLocalDate();

    await ctx.prisma.dailyPlan.create({
      data: {
        userId: user.user.id,
        planLocalDate: legacyLocalDate,
        planTimezone: 'UTC',
        status: 'READY',
        readinessLevel: 'MAINTAIN',
        createdByAi: false,
        planJson: {
          status: 'READY',
          readinessLevel: 'MAINTAIN',
          planLocalDate: legacyLocalDate,
          planTimezone: 'UTC',
          generatedAt: '2026-06-02T00:00:00.000Z',
          mockVersion: 'legacy',
          plan: {
            summary: 'Legacy plan summary',
            calorieGuidance: {
              targetCalories: 2100,
              reason: 'A balanced target for steady energy today.'
            },
            macroGuidance: {
              proteinGrams: 130,
              carbsGrams: 220,
              fatsGrams: 65
            },
            meals: [
              {
                mealName: 'Breakfast',
                timing: 'Morning',
                foods: [{ name: 'Eggs', portion: '2', notes: 'Simple option' }],
                approxCalories: 400,
                notes: 'Steady start'
              }
            ],
            hydration: {
              targetLiters: 2.3,
              timingNotes: 'Sip regularly.'
            },
            trainingRecommendation: {
              mode: 'MAINTAIN',
              summary: 'Controlled movement.',
              intensity: 'MODERATE',
              durationMinutes: 45
            },
            recoveryRecommendation: {
              summary: 'Rest well.',
              actions: ['Hydrate regularly']
            },
            coachExplanation: 'Consistency matters.',
            warnings: []
          }
        }
      }
    });

    const today = await request(ctx.app.getHttpServer())
      .get('/v1/daily-plans/today')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(today.body.id).toBeTruthy();
    expect(today.body.plan.schemaVersion).toBe('sprint-2.v1');
    expect(today.body.plan.summary.message).toBe('Legacy plan summary');
    expect(dailyPlanJsonSchema.safeParse(today.body.plan).success).toBe(true);
  });

  it('returns only the authenticated user daily plan history with normalized plans', async () => {
    const firstUser = await registerTestUser(ctx.app, 'history-one@example.com');
    const secondUser = await registerTestUser(ctx.app, 'history-two@example.com');

    await completeRequiredOnboarding(ctx.app, firstUser.accessToken, 'HistoryOne');
    await completeRequiredOnboarding(ctx.app, secondUser.accessToken, 'HistoryTwo');

    const firstPlan = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(firstUser.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);

    const secondPlan = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(secondUser.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);

    const history = await request(ctx.app.getHttpServer())
      .get('/v1/daily-plans/history?limit=10')
      .set(authHeader(firstUser.accessToken))
      .expect(200);

    expect(history.body.items).toHaveLength(1);
    expect(history.body.items[0].id).toBe(firstPlan.body.id);
    expect(history.body.items[0].id).not.toBe(secondPlan.body.id);
    expect(dailyPlanJsonSchema.safeParse(history.body.items[0].plan).success).toBe(true);
  });

  it('persists and updates one feedback record per user daily plan', async () => {
    const user = await registerTestUser(ctx.app);
    await completeRequiredOnboarding(ctx.app, user.accessToken, 'Feedback');

    const plan = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);

    const firstFeedback = await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${plan.body.id}/feedback`)
      .set(authHeader(user.accessToken))
      .send({
        rating: 'HELPFUL',
        tags: ['FELT_GOOD']
      })
      .expect(201);

    expect(firstFeedback.body.rating).toBe('HELPFUL');
    expect(firstFeedback.body.tags).toEqual(['FELT_GOOD']);

    const updatedFeedback = await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${plan.body.id}/feedback`)
      .set(authHeader(user.accessToken))
      .send({
        rating: 'NOT_HELPFUL',
        tags: ['LOW_ENERGY', 'TRAINING_TOO_HARD'],
        notes: 'Needed an easier day.'
      })
      .expect(201);

    expect(updatedFeedback.body.id).toBe(firstFeedback.body.id);
    expect(updatedFeedback.body.rating).toBe('NOT_HELPFUL');
    expect(updatedFeedback.body.tags).toEqual(['LOW_ENERGY', 'TRAINING_TOO_HARD']);
    expect(updatedFeedback.body.notes).toBe('Needed an easier day.');

    const feedbackCount = await ctx.prisma.dailyPlanFeedback.count({
      where: {
        userId: user.user.id,
        dailyPlanId: plan.body.id
      }
    });

    expect(feedbackCount).toBe(1);
  });

  it('prevents users from submitting feedback for another user plan', async () => {
    const owner = await registerTestUser(ctx.app, 'owner@example.com');
    const otherUser = await registerTestUser(ctx.app, 'other@example.com');

    await completeRequiredOnboarding(ctx.app, owner.accessToken, 'Owner');
    await completeRequiredOnboarding(ctx.app, otherUser.accessToken, 'Other');

    const ownerPlan = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(owner.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);

    await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${ownerPlan.body.id}/feedback`)
      .set(authHeader(otherUser.accessToken))
      .send({
        rating: 'HELPFUL',
        tags: ['FELT_GOOD']
      })
      .expect(404);
  });

  it('generates daily plans through the AiProvider abstraction', async () => {
    const customCtx = await createTestApp({
      providerOverrides: [
        {
          token: AI_PROVIDER,
          value: {
            generateDailyPlan: async (input: {
              planLocalDate: string;
              planTimezone: string;
              user: { firstName: string | null };
              safeMode: boolean;
            }) => ({
              ...createMockDailyPlan({
                planLocalDate: input.planLocalDate,
                planTimezone: input.planTimezone,
                firstName: input.user.firstName,
                isMinor: input.safeMode
              }),
              summary: {
                title: 'Provider seam verified',
                message: 'This plan came from the injected provider.',
                readiness: 'MAINTAIN'
              }
            })
          }
        }
      ]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'provider-seam@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'Provider');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('READY');
      expect(plan.body.plan.summary.title).toBe('Provider seam verified');
      expect(dailyPlanJsonSchema.safeParse(plan.body.plan).success).toBe(true);
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
    }
  });

  it('uses a safe fallback if AiProvider output is invalid', async () => {
    const customCtx = await createTestApp({
      providerOverrides: [
        {
          token: AI_PROVIDER,
          value: {
            generateDailyPlan: async () => ({
              schemaVersion: 'invalid-provider-output'
            })
          }
        }
      ]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'invalid-provider@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'Invalid');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('FALLBACK');
      expect(plan.body.plan.schemaVersion).toBe('sprint-2.v1');
      expect(plan.body.plan.safety.adjustedForSafety).toBe(true);
      expect(JSON.stringify(plan.body.plan)).toContain('could not be safely validated');
      expect(plan.body.plan.debug).toEqual({
        provider: 'fallback',
        generatedBy: 'SafeFallbackPlanFactory',
        fallbackReason: 'The generated plan could not be safely validated.'
      });
      expect(dailyPlanJsonSchema.safeParse(plan.body.plan).success).toBe(true);
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
    }
  });

  it('uses mock provider by default without requiring OPENAI_API_KEY', async () => {
    const previousProvider = process.env.AI_PROVIDER;
    const previousApiKey = process.env.OPENAI_API_KEY;
    delete process.env.AI_PROVIDER;
    delete process.env.OPENAI_API_KEY;

    const customCtx = await createTestApp();

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'mock-default@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'MockDefault');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('READY');
      expect(plan.body.plan.schemaVersion).toBe('sprint-2.v1');
      expect(plan.body.plan.debug).toEqual({
        provider: 'mock',
        generatedBy: 'MockAiProviderService'
      });
      expect(dailyPlanJsonSchema.safeParse(plan.body.plan).success).toBe(true);
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreOpenAiEnv(previousProvider, previousApiKey);
    }
  });

  it('validates SafetyAgentReview schema rules', () => {
    expect(
      safetyAgentReviewSchema.safeParse({
        approved: true,
        riskLevel: 'low',
        reasons: [],
        requiredChanges: []
      }).success
    ).toBe(true);

    expect(
      safetyAgentReviewSchema.safeParse({
        approved: true,
        riskLevel: 'medium',
        reasons: [],
        requiredChanges: []
      }).success
    ).toBe(false);

    expect(
      safetyAgentReviewSchema.safeParse({
        approved: true,
        riskLevel: 'high',
        reasons: [],
        requiredChanges: []
      }).success
    ).toBe(false);

    expect(
      safetyAgentReviewSchema.safeParse({
        approved: false,
        riskLevel: 'medium',
        reasons: [],
        requiredChanges: ['Use more supportive wording.']
      }).success
    ).toBe(false);

    expect(
      safetyAgentReviewSchema.safeParse({
        approved: false,
        riskLevel: 'medium',
        reasons: ['Tone is not supportive enough.'],
        requiredChanges: ['Use calmer, supportive wording.'],
        safeUserMessage: 'Choose a gentler plan today.'
      }).success
    ).toBe(true);

    expect(
      safetyAgentReviewSchema.safeParse({
        approved: false,
        riskLevel: 'medium',
        reasons: ['Tone is not supportive enough.'],
        requiredChanges: ['Use calmer, supportive wording.'],
        safeUserMessage: 'You are lazy and need punishment.'
      }).success
    ).toBe(false);
  });

  it('registers mock SafetyAgent defaults without changing runtime behavior', async () => {
    const safetyAgentConfig = ctx.app.get<SafetyAgentConfig>(SAFETY_AGENT_CONFIG);
    const safetyAgent = ctx.app.get<SafetyAgent>(SAFETY_AGENT);
    const plan = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'SafetyAgent',
      isMinor: false
    });

    await expect(
      safetyAgent.reviewDailyPlan({
        plan,
        safeMode: false,
        goalSummary: {
          goalType: 'IMPROVE_FITNESS',
          targetWeightKg: null,
          targetTimelineDays: null,
          impactMode: null
        },
        deterministicSafetyContext: {
          safeMode: false,
          isMinor: false,
          allergies: [],
          excludedFoods: [],
          deterministicSafetyPassed: true
        }
      })
    ).resolves.toEqual({
      approved: true,
      riskLevel: 'low',
      reasons: [],
      requiredChanges: []
    });

    expect(safetyAgentConfig).toEqual({
      enabled: false,
      provider: 'mock'
    });
  });

  it('does not call SafetyAgent when SAFETY_AGENT_ENABLED=false', async () => {
    const previousEnabled = process.env.SAFETY_AGENT_ENABLED;
    process.env.SAFETY_AGENT_ENABLED = 'false';
    let reviewCalls = 0;
    const customCtx = await createTestApp({
      providerOverrides: [
        {
          token: SAFETY_AGENT,
          value: {
            reviewDailyPlan: async () => {
              reviewCalls += 1;
              throw new Error('SafetyAgent should not be called when disabled.');
            }
          }
        }
      ]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'safety-agent-disabled@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'SafetyDisabled');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('READY');
      expect(plan.body.plan.debug.safetyAgent).toBeUndefined();
      expect(reviewCalls).toBe(0);
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreSafetyAgentEnv(previousEnabled, process.env.SAFETY_AGENT_PROVIDER);
    }
  });

  it('calls enabled mock SafetyAgent after deterministic safety passes', async () => {
    const previousEnabled = process.env.SAFETY_AGENT_ENABLED;
    process.env.SAFETY_AGENT_ENABLED = 'true';
    let reviewCalls = 0;
    const customCtx = await createTestApp({
      providerOverrides: [
        {
          token: SAFETY_AGENT,
          value: {
            reviewDailyPlan: async () => {
              reviewCalls += 1;
              return {
                approved: true,
                riskLevel: 'low',
                reasons: [],
                requiredChanges: []
              };
            }
          }
        }
      ]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'safety-agent-enabled@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'SafetyEnabled');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('READY');
      expect(plan.body.plan.debug.safetyAgent).toMatchObject({
        enabled: true,
        provider: 'mock',
        approved: true,
        riskLevel: 'low'
      });
      expect(reviewCalls).toBe(1);
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreSafetyAgentEnv(previousEnabled, process.env.SAFETY_AGENT_PROVIDER);
    }
  });

  it('skips SafetyAgent when deterministic safety fails', async () => {
    const previousEnabled = process.env.SAFETY_AGENT_ENABLED;
    process.env.SAFETY_AGENT_ENABLED = 'true';
    let reviewCalls = 0;
    const customCtx = await createTestApp({
      providerOverrides: [
        {
          token: SAFETY_AGENT,
          value: {
            reviewDailyPlan: async () => {
              reviewCalls += 1;
              return {
                approved: true,
                riskLevel: 'low',
                reasons: [],
                requiredChanges: []
              };
            }
          }
        }
      ]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'safety-agent-hard-fail@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'SafetyHardFail');

      await request(customCtx.app.getHttpServer())
        .put('/v1/nutrition-preferences')
        .set(authHeader(user.accessToken))
        .send({
          dietType: 'NONE',
          mealsPerDay: 3,
          allergies: ['Greek yogurt'],
          excludedFoods: [],
          preferredFoods: ['rice']
        })
        .expect(200);

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('FALLBACK');
      expect(plan.body.plan.debug.safetyAgent).toBeUndefined();
      expect(reviewCalls).toBe(0);
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreSafetyAgentEnv(previousEnabled, process.env.SAFETY_AGENT_PROVIDER);
    }
  });

  it.each([
    [
      'saves fallback when SafetyAgent rejects',
      async () => ({
        approved: false,
        riskLevel: 'medium',
        reasons: ['Plan tone needs semantic review.'],
        requiredChanges: ['Use safer wording.']
      }),
      'safety_agent_rejected',
      { approved: false, riskLevel: 'medium' }
    ],
    [
      'saves fallback when SafetyAgent throws',
      async () => {
        throw new Error('SafetyAgent unavailable');
      },
      'safety_agent_unavailable',
      {}
    ],
    [
      'saves fallback when SafetyAgent returns invalid review',
      async () => ({
        approved: true,
        riskLevel: 'high',
        reasons: [],
        requiredChanges: []
      }),
      'safety_agent_invalid_review',
      {}
    ]
  ])('%s', async (_name, reviewDailyPlan, expectedReason, expectedDebug) => {
    const previousEnabled = process.env.SAFETY_AGENT_ENABLED;
    process.env.SAFETY_AGENT_ENABLED = 'true';
    const customCtx = await createTestApp({
      providerOverrides: [
        {
          token: SAFETY_AGENT,
          value: {
            reviewDailyPlan
          }
        }
      ]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, `${expectedReason}@example.com`);
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'SafetyFallback');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('FALLBACK');
      expect(plan.body.plan.debug.fallbackReason).toBe(expectedReason);
      expect(plan.body.plan.debug.safetyAgent).toMatchObject({
        enabled: true,
        provider: 'mock',
        ...expectedDebug
      });
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreSafetyAgentEnv(previousEnabled, process.env.SAFETY_AGENT_PROVIDER);
    }
  });

  it('does not require OpenAI Safety Agent config when SAFETY_AGENT_ENABLED=false', async () => {
    const previousEnabled = process.env.SAFETY_AGENT_ENABLED;
    const previousProvider = process.env.SAFETY_AGENT_PROVIDER;
    const previousApiKey = process.env.OPENAI_API_KEY;
    const previousModel = process.env.OPENAI_DEFAULT_MODEL;
    process.env.SAFETY_AGENT_ENABLED = 'false';
    process.env.SAFETY_AGENT_PROVIDER = 'openai';
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_DEFAULT_MODEL;

    const customCtx = await createTestApp();

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'safety-agent-openai-disabled@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'SafetyOpenAiDisabled');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('READY');
      expect(plan.body.plan.debug.safetyAgent).toBeUndefined();
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreSafetyAgentEnv(previousEnabled, previousProvider);
      restoreOpenAiEnv(process.env.AI_PROVIDER, previousApiKey, previousModel);
    }
  });

  it('fails clearly when OpenAI Safety Agent is enabled without OPENAI_API_KEY', async () => {
    const previousEnabled = process.env.SAFETY_AGENT_ENABLED;
    const previousProvider = process.env.SAFETY_AGENT_PROVIDER;
    const previousApiKey = process.env.OPENAI_API_KEY;
    process.env.SAFETY_AGENT_ENABLED = 'true';
    process.env.SAFETY_AGENT_PROVIDER = 'openai';
    delete process.env.OPENAI_API_KEY;

    try {
      await expect(createTestApp()).rejects.toThrow(
        'OPENAI_API_KEY is required when SAFETY_AGENT_PROVIDER=openai.'
      );
    } finally {
      restoreSafetyAgentEnv(previousEnabled, previousProvider);
      process.env.OPENAI_API_KEY =
        previousApiKey === undefined ? process.env.OPENAI_API_KEY : previousApiKey;
      if (previousApiKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      }
    }
  });

  it('uses OpenAiSafetyAgentService when enabled with SAFETY_AGENT_PROVIDER=openai', async () => {
    const requests: Array<Record<string, unknown>> = [];
    const customCtx = await createOpenAiSafetyAgentModeTestApp({
      responses: [
        () => ({
          output_text: JSON.stringify({
            approved: true,
            riskLevel: 'low',
            reasons: [],
            requiredChanges: [],
            safeUserMessage: ''
          })
        })
      ],
      requests
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'safety-agent-openai-approve@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'SafetyOpenAiApprove');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('READY');
      expect(plan.body.plan.debug.safetyAgent).toMatchObject({
        enabled: true,
        provider: 'openai',
        approved: true,
        riskLevel: 'low'
      });
      expect(requests[0].text).toMatchObject({
        format: {
          type: 'json_schema',
          name: 'safety_agent_review',
          strict: true
        }
      });
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreSafetyAgentEnv(undefined, undefined);
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it.each([
    [
      'returns fallback when OpenAI Safety Agent rejects',
      () => ({
        output_text: JSON.stringify({
          approved: false,
          riskLevel: 'medium',
          reasons: ['The plan uses unsafe training framing.'],
          requiredChanges: ['Remove unsafe training framing.'],
          safeUserMessage: 'Choose a safer plan today.'
        })
      }),
      'safety_agent_rejected'
    ],
    [
      'returns fallback when OpenAI Safety Agent returns invalid review',
      () => ({
        output_text: JSON.stringify({
          approved: true,
          riskLevel: 'high',
          reasons: [],
          requiredChanges: [],
          safeUserMessage: ''
        })
      }),
      'safety_agent_invalid_review'
    ],
    [
      'returns fallback when OpenAI Safety Agent request fails',
      () => ({
        throw: { name: 'APIConnectionTimeoutError', message: 'Request timeout', code: 'ETIMEDOUT' }
      }),
      'safety_agent_unavailable'
    ]
  ])('%s', async (_name, responseFactory, expectedReason) => {
    const customCtx = await createOpenAiSafetyAgentModeTestApp({
      responses: [responseFactory]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, `${expectedReason}-openai@example.com`);
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'SafetyOpenAiFallback');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('FALLBACK');
      expect(plan.body.plan.debug.fallbackReason).toBe(expectedReason);
      expect(plan.body.plan.debug.safetyAgent).toMatchObject({
        enabled: true,
        provider: 'openai'
      });
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreSafetyAgentEnv(undefined, undefined);
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('skips OpenAI Safety Agent when deterministic safety fails', async () => {
    const requests: Array<Record<string, unknown>> = [];
    const customCtx = await createOpenAiSafetyAgentModeTestApp({
      responses: [
        () => ({
          output_text: JSON.stringify({
            approved: true,
            riskLevel: 'low',
            reasons: [],
            requiredChanges: [],
            safeUserMessage: ''
          })
        })
      ],
      requests
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'safety-agent-openai-hard-fail@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'SafetyOpenAiHardFail');

      await request(customCtx.app.getHttpServer())
        .put('/v1/nutrition-preferences')
        .set(authHeader(user.accessToken))
        .send({
          dietType: 'NONE',
          mealsPerDay: 3,
          allergies: ['Greek yogurt'],
          excludedFoods: [],
          preferredFoods: ['rice']
        })
        .expect(200);

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('FALLBACK');
      expect(plan.body.plan.debug.safetyAgent).toBeUndefined();
      expect(requests).toHaveLength(0);
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreSafetyAgentEnv(undefined, undefined);
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('retries OpenAI daily plan once with SafetyAgent feedback and saves READY when retry passes', async () => {
    const requests: Array<Record<string, unknown>> = [];
    const firstPlan = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'RetrySafety',
      isMinor: false
    });
    const retriedPlan = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'RetrySafetyFixed',
      isMinor: false
    });

    const customCtx = await createOpenAiDailyAndSafetyAgentModeTestApp({
      responses: [
        () => ({ output_text: JSON.stringify(firstPlan) }),
        () => ({
          output_text: JSON.stringify({
            approved: false,
            riskLevel: 'medium',
            reasons: ['Training wording is too aggressive.'],
            requiredChanges: ['Use gentler training wording.'],
            safeUserMessage: 'Choose a safer plan today.'
          })
        }),
        () => ({ output_text: JSON.stringify(retriedPlan) }),
        () => ({
          output_text: JSON.stringify({
            approved: true,
            riskLevel: 'low',
            reasons: [],
            requiredChanges: [],
            safeUserMessage: ''
          })
        })
      ],
      requests
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'safety-retry-ready@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'RetrySafety');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('READY');
      expect(plan.body.plan.debug.provider).toBe('openai');
      expect(plan.body.plan.debug.safetyAgent).toMatchObject({
        enabled: true,
        provider: 'openai',
        approved: true,
        riskLevel: 'low',
        retryUsed: true,
        retryResult: 'approved'
      });
      expect(requests).toHaveLength(4);
      const retryRequestInput = requests[2].input as Array<{ content?: string }>;
      const retryContext = JSON.parse(retryRequestInput[1].content ?? '{}') as {
        safetyFeedback?: unknown;
      };
      expect(retryContext.safetyFeedback).toMatchObject({
        riskLevel: 'medium',
        reasons: ['Training wording is too aggressive.'],
        requiredChanges: ['Use gentler training wording.']
      });
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreSafetyAgentEnv(undefined, undefined);
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('saves FALLBACK when SafetyAgent rejects the retried OpenAI plan', async () => {
    const planJson = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'RetryRejected',
      isMinor: false
    });
    const customCtx = await createOpenAiDailyAndSafetyAgentModeTestApp({
      responses: [
        () => ({ output_text: JSON.stringify(planJson) }),
        () => ({
          output_text: JSON.stringify({
            approved: false,
            riskLevel: 'medium',
            reasons: ['Tone is too forceful.'],
            requiredChanges: ['Use softer tone.'],
            safeUserMessage: 'Choose a safer plan today.'
          })
        }),
        () => ({ output_text: JSON.stringify(planJson) }),
        () => ({
          output_text: JSON.stringify({
            approved: false,
            riskLevel: 'medium',
            reasons: ['Tone is still too forceful.'],
            requiredChanges: ['Use softer tone.'],
            safeUserMessage: 'Choose a safer plan today.'
          })
        })
      ]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'safety-retry-rejected@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'RetryRejected');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('FALLBACK');
      expect(plan.body.plan.debug.fallbackReason).toBe('safety_agent_retry_rejected');
      expect(plan.body.plan.debug.safetyAgent).toMatchObject({
        enabled: true,
        provider: 'openai',
        approved: false,
        riskLevel: 'medium',
        retryUsed: true,
        retryResult: 'rejected'
      });
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreSafetyAgentEnv(undefined, undefined);
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('saves FALLBACK when retry OpenAI generation fails', async () => {
    const planJson = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'RetryFailed',
      isMinor: false
    });
    const customCtx = await createOpenAiDailyAndSafetyAgentModeTestApp({
      responses: [
        () => ({ output_text: JSON.stringify(planJson) }),
        () => ({
          output_text: JSON.stringify({
            approved: false,
            riskLevel: 'medium',
            reasons: ['Plan needs safer wording.'],
            requiredChanges: ['Use safer wording.'],
            safeUserMessage: 'Choose a safer plan today.'
          })
        }),
        () => ({ throw: { name: 'APIConnectionTimeoutError', message: 'Request timeout', code: 'ETIMEDOUT' } }),
        () => ({ throw: { name: 'APIConnectionTimeoutError', message: 'Request timeout', code: 'ETIMEDOUT' } })
      ]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'safety-retry-failed@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'RetryFailed');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('FALLBACK');
      expect(plan.body.plan.debug.fallbackReason).toBe('safety_agent_retry_failed');
      expect(plan.body.plan.debug.safetyAgent).toMatchObject({
        enabled: true,
        provider: 'openai',
        retryUsed: true,
        retryResult: 'failed'
      });
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreSafetyAgentEnv(undefined, undefined);
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('saves FALLBACK when retry OpenAI generation returns invalid structured output', async () => {
    const planJson = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'RetryInvalidOutput',
      isMinor: false
    });
    const invalidDailyPlan = {
      summary: {
        title: 'Incomplete retry plan'
      }
    };
    const customCtx = await createOpenAiDailyAndSafetyAgentModeTestApp({
      responses: [
        () => ({ output_text: JSON.stringify(planJson) }),
        () => ({
          output_text: JSON.stringify({
            approved: false,
            riskLevel: 'medium',
            reasons: ['Plan needs safer wording.'],
            requiredChanges: ['Use safer wording.'],
            safeUserMessage: 'Choose a safer plan today.'
          })
        }),
        () => ({ output_text: JSON.stringify(invalidDailyPlan) }),
        () => ({ output_text: JSON.stringify(invalidDailyPlan) })
      ]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'safety-retry-invalid@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'RetryInvalidOutput');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('FALLBACK');
      expect(plan.body.plan.debug.fallbackReason).toBe('safety_agent_retry_invalid_output');
      expect(plan.body.plan.debug.safetyAgent).toMatchObject({
        enabled: true,
        provider: 'openai',
        retryUsed: true,
        retryResult: 'failed'
      });
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreSafetyAgentEnv(undefined, undefined);
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('fails fast when AI_PROVIDER=openai is configured without OPENAI_API_KEY', async () => {
    const previousProvider = process.env.AI_PROVIDER;
    const previousApiKey = process.env.OPENAI_API_KEY;
    process.env.AI_PROVIDER = 'openai';
    delete process.env.OPENAI_API_KEY;

    try {
      await expect(createTestApp()).rejects.toThrow(
        'OPENAI_API_KEY is required when AI_PROVIDER=openai.'
      );
    } finally {
      restoreOpenAiEnv(previousProvider, previousApiKey);
    }
  });

  it('fails fast when AI_PROVIDER=openai is configured without OPENAI_DEFAULT_MODEL', async () => {
    const previousProvider = process.env.AI_PROVIDER;
    const previousApiKey = process.env.OPENAI_API_KEY;
    const previousModel = process.env.OPENAI_DEFAULT_MODEL;
    process.env.AI_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'test-key';
    delete process.env.OPENAI_DEFAULT_MODEL;

    try {
      await expect(createTestApp()).rejects.toThrow(
        'OPENAI_DEFAULT_MODEL is required when AI_PROVIDER=openai.'
      );
    } finally {
      restoreOpenAiEnv(previousProvider, previousApiKey, previousModel);
    }
  });

  it('uses OpenAiProviderService and sends a structured-output request when AI_PROVIDER=openai', async () => {
    const requests: Array<Record<string, unknown>> = [];
    const customCtx = await createOpenAiModeTestApp({
      responses: [
        () => ({
          output_text: JSON.stringify(
            createMockDailyPlan({
              planLocalDate: getUtcLocalDate(),
              planTimezone: 'UTC',
              firstName: 'OpenAI',
              isMinor: false
            })
          )
        })
      ],
      requests
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'openai-provider@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'OpenAI');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('READY');
      expect(plan.body.plan.schemaVersion).toBe('sprint-2.v1');
      expect(plan.body.plan.debug).toEqual({
        provider: 'openai',
        generatedBy: 'OpenAiProviderService'
      });
      expect(requests).toHaveLength(1);
      expect(requests[0].model).toBe('test-openai-model');
      expect(requests[0].max_output_tokens).toBe(4000);
      expect(requests[0].requestTimeout).toBe(45000);
      expect(requests[0]).toMatchObject({
        text: {
          format: {
            type: 'json_schema',
            name: 'daily_plan_json',
            strict: true
          }
        }
      });
      expect(JSON.stringify(requests[0].input)).toContain('usePlanLocalDateForTitleAndMessage');
      expect(JSON.stringify(requests[0].input)).toContain('Do not include schemaVersion');
      expect(JSON.stringify(requests[0].input)).toContain('Never derive user-facing dates from generatedAt');
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('respects OpenAI timeout and max output token config', async () => {
    const previousTimeout = process.env.OPENAI_REQUEST_TIMEOUT_MS;
    const previousMaxTokens = process.env.OPENAI_MAX_OUTPUT_TOKENS;
    process.env.OPENAI_REQUEST_TIMEOUT_MS = '12345';
    process.env.OPENAI_MAX_OUTPUT_TOKENS = '2345';
    const requests: Array<Record<string, unknown>> = [];
    const customCtx = await createOpenAiModeTestApp({
      responses: [
        () => ({
          output_text: JSON.stringify(
            createMockDailyPlan({
              planLocalDate: getUtcLocalDate(),
              planTimezone: 'UTC',
              firstName: 'Config',
              isMinor: false
            })
          )
        })
      ],
      requests
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'openai-config@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'Config');

      await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(requests[0].max_output_tokens).toBe(2345);
      expect(requests[0].requestTimeout).toBe(12345);
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreOpenAiEnv(undefined, undefined, undefined, previousTimeout, previousMaxTokens);
    }
  });

  it('retries once when OpenAI returns invalid output, then accepts valid DailyPlanJson', async () => {
    const requests: Array<Record<string, unknown>> = [];
    const customCtx = await createOpenAiModeTestApp({
      responses: [
        () => ({ output_text: JSON.stringify({ schemaVersion: 'wrong' }) }),
        () => ({
          output_text: JSON.stringify(
            createMockDailyPlan({
              planLocalDate: getUtcLocalDate(),
              planTimezone: 'UTC',
              firstName: 'Retry',
              isMinor: false
            })
          )
        })
      ],
      requests
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'openai-retry@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'Retry');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('READY');
      expect(plan.body.plan.summary.message).toContain('Retry');
      expect(plan.body.plan.debug.provider).toBe('openai');
      expect(requests).toHaveLength(2);
      expect(JSON.stringify(requests[1])).toContain('This is a retry');
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('normalizes invalid OpenAI generatedAt metadata and returns READY', async () => {
    const openAiPlan = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'InvalidGeneratedAt',
      isMinor: false
    });
    openAiPlan.generatedAt = 'not-a-date';

    const customCtx = await createOpenAiModeTestApp({
      responses: [() => ({ output_text: JSON.stringify(openAiPlan) })]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'openai-invalid-generated-at@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'InvalidGeneratedAt');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('READY');
      expect(plan.body.plan.generatedAt).not.toBe('not-a-date');
      expect(plan.body.plan.mockVersion).toBe(0);
      expect(plan.body.plan.debug.provider).toBe('openai');
      expect(dailyPlanJsonSchema.safeParse(plan.body.plan).success).toBe(true);
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('normalizes missing OpenAI generatedAt and debug metadata and returns READY', async () => {
    const openAiPlan = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'MissingMetadata',
      isMinor: false
    }) as Record<string, unknown>;
    delete openAiPlan.generatedAt;
    delete openAiPlan.debug;

    const customCtx = await createOpenAiModeTestApp({
      responses: [() => ({ output_text: JSON.stringify(openAiPlan) })]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'openai-missing-metadata@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'MissingMetadata');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('READY');
      expect(plan.body.plan.generatedAt).toBeTruthy();
      expect(plan.body.plan.mockVersion).toBe(0);
      expect(plan.body.plan.debug).toEqual({
        provider: 'openai',
        generatedBy: 'OpenAiProviderService'
      });
      expect(dailyPlanJsonSchema.safeParse(plan.body.plan).success).toBe(true);
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('falls back when OpenAI content structure is genuinely invalid', async () => {
    const openAiPlan = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'InvalidStructure',
      isMinor: false
    }) as Record<string, unknown>;
    openAiPlan.nutrition = { meals: 'not-valid' };
    openAiPlan.training = { intensity: 'EXTREME' };

    const customCtx = await createOpenAiModeTestApp({
      responses: [() => ({ output_text: JSON.stringify(openAiPlan) }), () => ({ output_text: JSON.stringify(openAiPlan) })]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'openai-invalid-structure@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'InvalidStructure');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('FALLBACK');
      expect(plan.body.plan.debug.fallbackReason).toBe('schema_validation_failed');
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('falls back safely when OpenAI output is invalid after retry', async () => {
    const customCtx = await createOpenAiModeTestApp({
      responses: [
        () => ({ output_text: JSON.stringify({ schemaVersion: 'wrong' }) }),
        () => ({ output_text: 'not json' })
      ]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'openai-invalid@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'InvalidOpenAI');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('FALLBACK');
      expect(plan.body.plan.schemaVersion).toBe('sprint-2.v1');
      expect(plan.body.plan.debug).toEqual({
        provider: 'fallback',
        generatedBy: 'SafeFallbackPlanFactory',
        fallbackReason: 'json_parse_failed'
      });
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('still runs SafetyService after OpenAI provider output', async () => {
    const customCtx = await createOpenAiModeTestApp({
      responses: [
        () => ({
          output_text: JSON.stringify(
            createMockDailyPlan({
              planLocalDate: getUtcLocalDate(),
              planTimezone: 'UTC',
              firstName: 'UnsafeFood',
              isMinor: false
            })
          )
        })
      ]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'openai-safety@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'UnsafeFood');

      await request(customCtx.app.getHttpServer())
        .put('/v1/nutrition-preferences')
        .set(authHeader(user.accessToken))
        .send({
          dietType: 'NONE',
          mealsPerDay: 3,
          allergies: ['Greek yogurt'],
          excludedFoods: [],
          preferredFoods: ['rice']
        })
        .expect(200);

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('FALLBACK');
      expect(JSON.stringify(plan.body.plan)).not.toContain('Greek yogurt');
      expect(JSON.stringify(plan.body.plan)).toContain('conflicts with your allergies');
      expect(plan.body.plan.debug.fallbackReason).toContain('conflicts with your allergies');
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('allows OpenAI allergy mentions that only say the food is avoided', async () => {
    const openAiPlan = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'AvoidAllergy',
      isMinor: false
    });
    openAiPlan.reminders = ['Avoid avocado today because it is listed as an allergy.'];
    openAiPlan.nutrition.meals[0].foods[0].notes = 'Add variety and fiber, avoiding avocado.';

    const customCtx = await createOpenAiModeTestApp({
      responses: [() => ({ output_text: JSON.stringify(openAiPlan) })]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'openai-avoid-allergy@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'AvoidAllergy');

      await request(customCtx.app.getHttpServer())
        .put('/v1/nutrition-preferences')
        .set(authHeader(user.accessToken))
        .send({
          dietType: 'NONE',
          mealsPerDay: 3,
          allergies: ['avocado'],
          excludedFoods: [],
          preferredFoods: ['rice']
        })
        .expect(200);

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('READY');
      expect(plan.body.plan.debug.provider).toBe('openai');
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('normalizes OpenAI food names with safe avoidance qualifiers before safety checks', async () => {
    const openAiPlan = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'NormalizeFoodName',
      isMinor: false
    });
    openAiPlan.nutrition.meals[0].foods[0].name = 'Mixed salad (no avocado, no broccoli)';

    const customCtx = await createOpenAiModeTestApp({
      responses: [() => ({ output_text: JSON.stringify(openAiPlan) })]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'openai-normalize-food-name@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'NormalizeFoodName');

      await request(customCtx.app.getHttpServer())
        .put('/v1/nutrition-preferences')
        .set(authHeader(user.accessToken))
        .send({
          dietType: 'NONE',
          mealsPerDay: 3,
          allergies: ['avocado'],
          excludedFoods: ['broccoli'],
          preferredFoods: ['rice']
        })
        .expect(200);

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('READY');
      expect(plan.body.plan.nutrition.meals[0].foods[0].name).toBe('Mixed salad');
      expect(plan.body.plan.nutrition.meals[0].foods[0].notes).toContain(
        'Prepared without avocado and broccoli.'
      );
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('allows OpenAI reminders that only say an excluded food is avoided', async () => {
    const openAiPlan = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'AvoidExcluded',
      isMinor: false
    });
    openAiPlan.reminders = ['This plan avoids pork as requested.'];

    const customCtx = await createOpenAiModeTestApp({
      responses: [() => ({ output_text: JSON.stringify(openAiPlan) })]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'openai-avoid-excluded@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'AvoidExcluded');

      await request(customCtx.app.getHttpServer())
        .put('/v1/nutrition-preferences')
        .set(authHeader(user.accessToken))
        .send({
          dietType: 'NONE',
          mealsPerDay: 3,
          allergies: [],
          excludedFoods: ['pork'],
          preferredFoods: ['rice']
        })
        .expect(200);

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('READY');
      expect(plan.body.plan.debug.provider).toBe('openai');
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('blocks allergies in meal food names and recommended notes', async () => {
    const openAiPlan = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'AllergyConflict',
      isMinor: false
    });
    openAiPlan.nutrition.meals[0].foods[0].name = 'Avocado toast';

    const noteConflictPlan = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'AllergyNoteConflict',
      isMinor: false
    });
    noteConflictPlan.nutrition.meals[0].foods[0].notes = 'Serve with avocado on top.';

    for (const [email, planJson] of [
      ['openai-allergy-name-conflict@example.com', openAiPlan],
      ['openai-allergy-note-conflict@example.com', noteConflictPlan]
    ] as const) {
      const customCtx = await createOpenAiModeTestApp({
        responses: [() => ({ output_text: JSON.stringify(planJson) })]
      });

      try {
        await cleanupDatabase(customCtx.prisma);
        const user = await registerTestUser(customCtx.app, email);
        await completeRequiredOnboarding(customCtx.app, user.accessToken, 'AllergyConflict');

        await request(customCtx.app.getHttpServer())
          .put('/v1/nutrition-preferences')
          .set(authHeader(user.accessToken))
          .send({
            dietType: 'NONE',
            mealsPerDay: 3,
            allergies: ['avocado'],
            excludedFoods: [],
            preferredFoods: ['rice']
          })
          .expect(200);

        const plan = await request(customCtx.app.getHttpServer())
          .post('/v1/daily-plans/generate')
          .set(authHeader(user.accessToken))
          .send({ forceRegenerate: true })
          .expect(201);

        expect(plan.body.status).toBe('FALLBACK');
        expect(plan.body.plan.debug.fallbackReason).toContain('conflicts with your allergies');
      } finally {
        await cleanupDatabase(customCtx.prisma);
        await customCtx.app.close();
        restoreOpenAiEnv(undefined, undefined, undefined);
      }
    }
  });

  it('blocks excluded foods in meal food names but allows avoid notes', async () => {
    const conflictPlan = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'ExcludedConflict',
      isMinor: false
    });
    conflictPlan.nutrition.meals[0].foods[0].name = 'Pork rice bowl';

    const allowedPlan = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'ExcludedAvoid',
      isMinor: false
    });
    allowedPlan.nutrition.meals[0].foods[0].notes = 'Avoid pork and use chicken instead.';

    for (const [email, planJson, expectedStatus] of [
      ['openai-excluded-name-conflict@example.com', conflictPlan, 'FALLBACK'],
      ['openai-excluded-avoid-note@example.com', allowedPlan, 'READY']
    ] as const) {
      const customCtx = await createOpenAiModeTestApp({
        responses: [() => ({ output_text: JSON.stringify(planJson) })]
      });

      try {
        await cleanupDatabase(customCtx.prisma);
        const user = await registerTestUser(customCtx.app, email);
        await completeRequiredOnboarding(customCtx.app, user.accessToken, 'ExcludedFood');

        await request(customCtx.app.getHttpServer())
          .put('/v1/nutrition-preferences')
          .set(authHeader(user.accessToken))
          .send({
            dietType: 'NONE',
            mealsPerDay: 3,
            allergies: [],
            excludedFoods: ['pork'],
            preferredFoods: ['rice']
          })
          .expect(200);

        const plan = await request(customCtx.app.getHttpServer())
          .post('/v1/daily-plans/generate')
          .set(authHeader(user.accessToken))
          .send({ forceRegenerate: true })
          .expect(201);

        expect(plan.body.status).toBe(expectedStatus);
      } finally {
        await cleanupDatabase(customCtx.prisma);
        await customCtx.app.close();
        restoreOpenAiEnv(undefined, undefined, undefined);
      }
    }
  });

  it.each([
    [
      'maps OpenAI auth errors to fallback reason',
      { name: 'AuthenticationError', message: 'Invalid API key', status: 401, code: 'invalid_api_key' },
      'openai_auth_error'
    ],
    [
      'maps OpenAI invalid model errors to fallback reason',
      { name: 'BadRequestError', message: 'Model does not exist', status: 400, code: 'model_not_found' },
      'openai_invalid_model'
    ],
    [
      'maps OpenAI rate limit errors to fallback reason',
      { name: 'RateLimitError', message: 'Rate limit reached', status: 429, code: 'rate_limit_exceeded' },
      'openai_rate_limited'
    ],
    [
      'maps OpenAI timeout errors to fallback reason',
      { name: 'APIConnectionTimeoutError', message: 'Request timeout', code: 'ETIMEDOUT' },
      'openai_timeout'
    ]
  ])('%s', async (_name, sdkError, expectedReason) => {
    const customCtx = await createOpenAiModeTestApp({
      responses: [() => ({ throw: sdkError }), () => ({ throw: sdkError })]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app);
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'OpenAiError');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('FALLBACK');
      expect(plan.body.plan.debug.fallbackReason).toBe(expectedReason);
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });
});

async function completeRequiredOnboarding(app: TestApp['app'], token: string, firstName = 'Alex') {
  await request(app.getHttpServer())
    .put('/v1/profile')
    .set(authHeader(token))
    .send({
      firstName,
      lastName: 'User',
      dateOfBirth: '1990-01-01',
      heightCm: 180,
      weightKg: 80,
      activityLevel: 'MODERATE',
      privacyConsentAccepted: true
    })
    .expect(200);

  await request(app.getHttpServer())
    .put('/v1/goals')
    .set(authHeader(token))
    .send({
      goalType: 'IMPROVE_FITNESS'
    })
    .expect(200);

  await request(app.getHttpServer())
    .put('/v1/nutrition-preferences')
    .set(authHeader(token))
    .send({
      dietType: 'NONE',
      mealsPerDay: 3,
      allergies: ['peanuts'],
      excludedFoods: ['shellfish'],
      preferredFoods: ['rice', 'eggs']
    })
    .expect(200);

  await request(app.getHttpServer())
    .post('/v1/training-schedule/items')
    .set(authHeader(token))
    .send({
      dayOfWeek: 1,
      localTime: '07:30',
      sportType: 'RUNNING',
      durationMinutes: 30,
      intensity: 'MODERATE',
      description: 'Easy run'
    })
    .expect(201);
}

function getUtcLocalDate() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

function restoreOpenAiEnv(
  aiProvider: string | undefined,
  apiKey: string | undefined,
  defaultModel?: string | undefined,
  requestTimeoutMs?: string | undefined,
  maxOutputTokens?: string | undefined
) {
  if (aiProvider === undefined) {
    delete process.env.AI_PROVIDER;
  } else {
    process.env.AI_PROVIDER = aiProvider;
  }

  if (apiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = apiKey;
  }

  if (defaultModel === undefined) {
    delete process.env.OPENAI_DEFAULT_MODEL;
  } else {
    process.env.OPENAI_DEFAULT_MODEL = defaultModel;
  }

  if (requestTimeoutMs === undefined) {
    delete process.env.OPENAI_REQUEST_TIMEOUT_MS;
  } else {
    process.env.OPENAI_REQUEST_TIMEOUT_MS = requestTimeoutMs;
  }

  if (maxOutputTokens === undefined) {
    delete process.env.OPENAI_MAX_OUTPUT_TOKENS;
  } else {
    process.env.OPENAI_MAX_OUTPUT_TOKENS = maxOutputTokens;
  }
}

function restoreSafetyAgentEnv(enabled: string | undefined, provider: string | undefined) {
  if (enabled === undefined) {
    delete process.env.SAFETY_AGENT_ENABLED;
  } else {
    process.env.SAFETY_AGENT_ENABLED = enabled;
  }

  if (provider === undefined) {
    delete process.env.SAFETY_AGENT_PROVIDER;
  } else {
    process.env.SAFETY_AGENT_PROVIDER = provider;
  }
}

type MockOpenAiResponse = { output_text?: string } | { throw: unknown };

async function createOpenAiModeTestApp(options: {
  responses: Array<() => MockOpenAiResponse>;
  requests?: Array<Record<string, unknown>>;
}) {
  process.env.AI_PROVIDER = 'openai';
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_DEFAULT_MODEL = 'test-openai-model';

  let callIndex = 0;

  return createTestApp({
    providerOverrides: [
      {
        token: OPENAI_CLIENT_FACTORY,
        value: () => ({
          responses: {
            create: async (input: Record<string, unknown>, requestOptions?: Record<string, unknown>) => {
              options.requests?.push(input);
              const response = options.responses[Math.min(callIndex, options.responses.length - 1)]();
              callIndex += 1;
              if ('throw' in response) {
                throw response.throw;
              }
              if (requestOptions?.timeout) {
                input.requestTimeout = requestOptions.timeout;
              }
              return response;
            }
          }
        })
      }
    ]
  });
}

async function createOpenAiSafetyAgentModeTestApp(options: {
  responses: Array<() => MockOpenAiResponse>;
  requests?: Array<Record<string, unknown>>;
}) {
  delete process.env.AI_PROVIDER;
  process.env.SAFETY_AGENT_ENABLED = 'true';
  process.env.SAFETY_AGENT_PROVIDER = 'openai';
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_DEFAULT_MODEL = 'test-openai-model';

  let callIndex = 0;

  return createTestApp({
    providerOverrides: [
      {
        token: OPENAI_CLIENT_FACTORY,
        value: () => ({
          responses: {
            create: async (input: Record<string, unknown>, requestOptions?: Record<string, unknown>) => {
              options.requests?.push(input);
              const response = options.responses[Math.min(callIndex, options.responses.length - 1)]();
              callIndex += 1;
              if ('throw' in response) {
                throw response.throw;
              }
              if (requestOptions?.timeout) {
                input.requestTimeout = requestOptions.timeout;
              }
              return response;
            }
          }
        })
      }
    ]
  });
}

async function createOpenAiDailyAndSafetyAgentModeTestApp(options: {
  responses: Array<() => MockOpenAiResponse>;
  requests?: Array<Record<string, unknown>>;
}) {
  process.env.AI_PROVIDER = 'openai';
  process.env.SAFETY_AGENT_ENABLED = 'true';
  process.env.SAFETY_AGENT_PROVIDER = 'openai';
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_DEFAULT_MODEL = 'test-openai-model';

  let callIndex = 0;

  return createTestApp({
    providerOverrides: [
      {
        token: OPENAI_CLIENT_FACTORY,
        value: () => ({
          responses: {
            create: async (input: Record<string, unknown>, requestOptions?: Record<string, unknown>) => {
              options.requests?.push(input);
              const response = options.responses[Math.min(callIndex, options.responses.length - 1)]();
              callIndex += 1;
              if ('throw' in response) {
                throw response.throw;
              }
              if (requestOptions?.timeout) {
                input.requestTimeout = requestOptions.timeout;
              }
              return response;
            }
          }
        })
      }
    ]
  });
}
