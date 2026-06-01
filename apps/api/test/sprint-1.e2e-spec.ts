import request from 'supertest';

import { cleanupDatabase } from './helpers/cleanup';
import { authHeader, registerTestUser } from './helpers/auth';
import { createTestApp, TestApp } from './helpers/test-app';

describe('Sprint 1 backend vertical slice', () => {
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
    expect(first.body.planId).toBe(stored.id);

    const today = await request(ctx.app.getHttpServer())
      .get('/v1/daily-plans/today')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(today.body.planId).toBe(first.body.planId);

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

    expect(noRegenerate.body.planId).toBe(first.body.planId);
    expect(JSON.stringify(noRegenerate.body.plan)).toContain('First');

    const regenerated = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);

    expect(regenerated.body.planId).toBe(first.body.planId);
    expect(JSON.stringify(regenerated.body.plan)).toContain('Second');
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
