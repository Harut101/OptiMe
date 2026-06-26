import request from 'supertest';
import {
  ExerciseEquipment,
  TargetMuscleGroup,
  TrainingEnvironment,
  TrainingScheduleDayOfWeek,
  TrainingScheduleOverrideMode
} from '@prisma/client';
import type { TrainingScheduleDayRequest } from '@optime/shared-types';

import { seedExerciseCatalog } from '../prisma/seeds/exercises/seed';
import { TrainingScheduleResolverService } from '../src/modules/training-schedule/training-schedule-resolver.service';
import { cleanupDatabase } from './helpers/cleanup';
import { authHeader, registerTestUser } from './helpers/auth';
import { createTestApp, TestApp } from './helpers/test-app';

const DAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY'
] as const;

describe('Weekly Training Schedule', () => {
  let ctx: TestApp;
  let resolver: TrainingScheduleResolverService;

  beforeAll(async () => {
    delete process.env.AI_PROVIDER;
    ctx = await createTestApp();
    resolver = ctx.app.get(TrainingScheduleResolverService);
    await seedExerciseCatalog(ctx.prisma);
  });

  beforeEach(async () => cleanupDatabase(ctx.prisma));

  afterAll(async () => {
    await cleanupDatabase(ctx.prisma);
    await ctx.app.close();
  });

  it('creates, reads, updates, and deactivates a seven-day schedule', async () => {
    const user = await registerTestUser(ctx.app);
    const payload = weeklyPayload({
      MONDAY: {
        isTrainingDay: true,
        targetMusclesMode: 'CUSTOM',
        targetMuscles: ['CHEST', 'TRICEPS'],
        environmentMode: 'CUSTOM',
        environment: 'HOME',
        equipmentMode: 'CUSTOM',
        availableEquipment: ['BARBELL', 'BENCH'],
        durationMode: 'CUSTOM',
        durationMinutes: 60
      }
    });

    const saved = await request(ctx.app.getHttpServer())
      .put('/v1/training-schedule')
      .set(authHeader(user.accessToken))
      .send(payload)
      .expect(200);

    expect(saved.body.isActive).toBe(true);
    expect(saved.body.days).toHaveLength(7);
    expect(saved.body.derivedWeeklyFrequency).toBe(1);
    const monday = saved.body.days.find((day: { dayOfWeek: string }) => day.dayOfWeek === 'MONDAY');
    expect(monday.resolved.environment).toBe('HOME');
    expect(monday.resolved.availableEquipment).toEqual(['BARBELL', 'BENCH']);

    const read = await request(ctx.app.getHttpServer())
      .get('/v1/training-schedule')
      .set(authHeader(user.accessToken))
      .expect(200);
    expect(read.body.id).toBe(saved.body.id);

    const deactivated = await request(ctx.app.getHttpServer())
      .delete('/v1/training-schedule')
      .set(authHeader(user.accessToken))
      .expect(200);
    expect(deactivated.body.isActive).toBe(false);
  });

  it('validates unique weekdays, custom muscles, and duplicate equipment', async () => {
    const user = await registerTestUser(ctx.app);
    const duplicateDayPayload = {
      isActive: true,
      days: DAYS.map((day) => baseDay(day)).map((day, index) =>
        index === 6 ? { ...day, dayOfWeek: 'MONDAY' } : day
      )
    };

    await request(ctx.app.getHttpServer())
      .put('/v1/training-schedule')
      .set(authHeader(user.accessToken))
      .send(duplicateDayPayload)
      .expect(400);

    await request(ctx.app.getHttpServer())
      .put('/v1/training-schedule')
      .set(authHeader(user.accessToken))
      .send(weeklyPayload({
        MONDAY: {
          isTrainingDay: true,
          targetMusclesMode: 'CUSTOM',
          targetMuscles: [],
          equipmentMode: 'CUSTOM',
          availableEquipment: ['BARBELL', 'BARBELL']
        }
      }))
      .expect(400);
  });

  it('resolves equipment explicitly without inferring from location', async () => {
    const user = await registerTestUser(ctx.app);
    await createTrainingPreference(user.user.id);
    await request(ctx.app.getHttpServer())
      .put('/v1/training-schedule')
      .set(authHeader(user.accessToken))
      .send(weeklyPayload({
        MONDAY: {
          isTrainingDay: true,
          environmentMode: 'CUSTOM',
          environment: 'HOME',
          equipmentMode: 'CUSTOM',
          availableEquipment: ['BARBELL']
        },
        TUESDAY: {
          isTrainingDay: true,
          environmentMode: 'CUSTOM',
          environment: 'GYM',
          equipmentMode: 'CUSTOM',
          availableEquipment: []
        }
      }))
      .expect(200);

    const monday = await resolver.resolveForUser({
      userId: user.user.id,
      planLocalDate: '2026-06-22',
      trainingPreference: await ctx.prisma.trainingPreference.findUnique({ where: { userId: user.user.id } }),
      legacyScheduleItems: [],
      noTrainingPlanned: false
    });
    expect(monday.dayOfWeek).toBe(TrainingScheduleDayOfWeek.MONDAY);
    expect(monday.environment).toBe(TrainingEnvironment.HOME);
    expect(monday.availableEquipment).toEqual([ExerciseEquipment.BARBELL]);

    const tuesday = await resolver.resolveForUser({
      userId: user.user.id,
      planLocalDate: '2026-06-23',
      trainingPreference: await ctx.prisma.trainingPreference.findUnique({ where: { userId: user.user.id } }),
      legacyScheduleItems: [],
      noTrainingPlanned: false
    });
    expect(tuesday.environment).toBe(TrainingEnvironment.GYM);
    expect(tuesday.availableEquipment).not.toContain(ExerciseEquipment.BARBELL);
    expect(tuesday.availableEquipment).toEqual([]);
  });

  it('stores a rest-day training schedule snapshot in newly generated daily plans', async () => {
    const user = await registerTestUser(ctx.app);
    await completeStageOne(user.accessToken);
    await request(ctx.app.getHttpServer())
      .put('/v1/training-schedule')
      .set(authHeader(user.accessToken))
      .send(weeklyPayload(Object.fromEntries(DAYS.map((day) => [day, { isTrainingDay: false }] as const))))
      .expect(200);

    const plan = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);

    expect(plan.body.plan.trainingScheduleSnapshot).toBeDefined();
    expect(plan.body.plan.trainingScheduleSnapshot.isTrainingDay).toBe(false);
    expect(plan.body.plan.training.exercises ?? []).toHaveLength(0);
  });

  async function createTrainingPreference(userId: string) {
    return ctx.prisma.trainingPreference.create({
      data: {
        userId,
        targetMuscleGroups: [TargetMuscleGroup.CHEST],
        equipment: [],
        trainingLevel: 'BEGINNER',
        limitationsOrPainAreas: [],
        preferredTrainingDays: []
      }
    });
  }

  async function completeStageOne(accessToken: string) {
    await request(ctx.app.getHttpServer()).put('/v1/profile').set(authHeader(accessToken)).send({
      firstName: 'Weekly',
      gender: 'prefer_not_to_say',
      dateOfBirth: '1995-01-01',
      heightCm: 180,
      weightKg: 80,
      activityLevel: 'MODERATE',
      privacyConsentAccepted: true
    }).expect(200);
    await request(ctx.app.getHttpServer()).put('/v1/goals').set(authHeader(accessToken)).send({
      goalType: 'IMPROVE_FITNESS'
    }).expect(200);
    await request(ctx.app.getHttpServer()).put('/v1/nutrition-preferences').set(authHeader(accessToken)).send({
      noKnownAllergiesConfirmed: true
    }).expect(200);
    await request(ctx.app.getHttpServer()).put('/v1/training-schedule/intent').set(authHeader(accessToken)).send({
      noTrainingPlanned: false
    }).expect(200);
  }
});

function weeklyPayload(overrides: Partial<Record<typeof DAYS[number], Partial<TrainingScheduleDayRequest>>>) {
  return {
    isActive: true,
    days: DAYS.map((day) => ({ ...baseDay(day), ...(overrides[day] ?? {}) }))
  };
}

function baseDay(dayOfWeek: typeof DAYS[number]): TrainingScheduleDayRequest {
  return {
    dayOfWeek,
    isTrainingDay: false,
    targetMusclesMode: TrainingScheduleOverrideMode.USE_DEFAULT,
    targetMuscles: [],
    environmentMode: TrainingScheduleOverrideMode.USE_DEFAULT,
    environment: null,
    equipmentMode: TrainingScheduleOverrideMode.USE_DEFAULT,
    availableEquipment: [],
    durationMode: TrainingScheduleOverrideMode.USE_DEFAULT,
    durationMinutes: null,
    protocolMode: TrainingScheduleOverrideMode.USE_DEFAULT,
    protocolPreference: null
  };
}
