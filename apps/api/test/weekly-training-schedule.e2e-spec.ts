import request from 'supertest';
import {
  DailyTrainingOverrideSource,
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

  it('resolves one-off training override before weekly rest day without mutating the routine', async () => {
    const user = await registerTestUser(ctx.app);
    await createTrainingPreference(user.user.id);
    await request(ctx.app.getHttpServer())
      .put('/v1/training-schedule')
      .set(authHeader(user.accessToken))
      .send(weeklyPayload({
        FRIDAY: { isTrainingDay: false }
      }))
      .expect(200);

    const override = await request(ctx.app.getHttpServer())
      .put('/v1/training-overrides/2026-06-26')
      .set(authHeader(user.accessToken))
      .send({
        overrideType: 'TRAINING_DAY',
        targetMuscles: ['CHEST'],
        environment: 'HOME',
        availableEquipment: ['BARBELL'],
        durationMinutes: 75,
        source: 'USER_SELECTED_TRAIN_TODAY'
      })
      .expect(200);

    expect(override.body.source).toBe(DailyTrainingOverrideSource.USER_SELECTED_TRAIN_TODAY);

    const resolved = await resolver.resolveForUser({
      userId: user.user.id,
      planLocalDate: '2026-06-26',
      trainingPreference: await ctx.prisma.trainingPreference.findUnique({ where: { userId: user.user.id } }),
      legacyScheduleItems: [],
      noTrainingPlanned: false
    });

    expect(resolved.source).toBe('DAILY_OVERRIDE');
    expect(resolved.overrideType).toBe('TRAINING_DAY');
    expect(resolved.isTrainingDay).toBe(true);
    expect(resolved.durationMinutes).toBe(75);
    expect(resolved.availableEquipment).toEqual([ExerciseEquipment.BARBELL]);

    const schedule = await request(ctx.app.getHttpServer())
      .get('/v1/training-schedule')
      .set(authHeader(user.accessToken))
      .expect(200);
    const friday = schedule.body.days.find((day: { dayOfWeek: string }) => day.dayOfWeek === 'FRIDAY');
    expect(friday.isTrainingDay).toBe(false);
  });

  it('resolves one-off rest override before weekly training day', async () => {
    const user = await registerTestUser(ctx.app);
    await createTrainingPreference(user.user.id);
    await request(ctx.app.getHttpServer())
      .put('/v1/training-schedule')
      .set(authHeader(user.accessToken))
      .send(weeklyPayload({
        MONDAY: {
          isTrainingDay: true,
          durationMode: 'CUSTOM',
          durationMinutes: 60,
          equipmentMode: 'CUSTOM',
          availableEquipment: ['BARBELL']
        }
      }))
      .expect(200);

    await request(ctx.app.getHttpServer())
      .put('/v1/training-overrides/2026-06-22')
      .set(authHeader(user.accessToken))
      .send({
        overrideType: 'REST_DAY',
        source: 'USER_SELECTED_REST_TODAY'
      })
      .expect(200);

    const resolved = await resolver.resolveForUser({
      userId: user.user.id,
      planLocalDate: '2026-06-22',
      trainingPreference: await ctx.prisma.trainingPreference.findUnique({ where: { userId: user.user.id } }),
      legacyScheduleItems: [],
      noTrainingPlanned: false
    });

    expect(resolved.source).toBe('DAILY_OVERRIDE');
    expect(resolved.overrideType).toBe('REST_DAY');
    expect(resolved.isTrainingDay).toBe(false);
    expect(resolved.availableEquipment).not.toContain(ExerciseEquipment.BARBELL);
  });

  it('validates daily override API ownership, dates, duplicates, and idempotent delete', async () => {
    const owner = await registerTestUser(ctx.app, 'override-owner@example.com');
    const other = await registerTestUser(ctx.app, 'override-other@example.com');

    await request(ctx.app.getHttpServer())
      .put('/v1/training-overrides/not-a-date')
      .set(authHeader(owner.accessToken))
      .send({ overrideType: 'REST_DAY' })
      .expect(400);

    await request(ctx.app.getHttpServer())
      .put('/v1/training-overrides/2026-06-27')
      .set(authHeader(owner.accessToken))
      .send({
        overrideType: 'TRAINING_DAY',
        availableEquipment: ['BARBELL', 'BARBELL']
      })
      .expect(400);

    await request(ctx.app.getHttpServer())
      .put('/v1/training-overrides/2026-06-27')
      .set(authHeader(owner.accessToken))
      .send({
        overrideType: 'TRAINING_DAY',
        environment: 'GYM',
        availableEquipment: [],
        durationMinutes: 30
      })
      .expect(200);

    const otherRead = await request(ctx.app.getHttpServer())
      .get('/v1/training-overrides?date=2026-06-27')
      .set(authHeader(other.accessToken))
      .expect(200);
    expect(otherRead.body.override).toBeNull();

    const ownerRead = await request(ctx.app.getHttpServer())
      .get('/v1/training-overrides?date=2026-06-27')
      .set(authHeader(owner.accessToken))
      .expect(200);
    expect(ownerRead.body.override.overrideType).toBe('TRAINING_DAY');
    expect(ownerRead.body.override.environment).toBe('GYM');
    expect(ownerRead.body.override.availableEquipment).toEqual([]);

    await request(ctx.app.getHttpServer())
      .delete('/v1/training-overrides/2026-06-27')
      .set(authHeader(owner.accessToken))
      .expect(200);

    const deleted = await request(ctx.app.getHttpServer())
      .get('/v1/training-overrides?date=2026-06-27')
      .set(authHeader(owner.accessToken))
      .expect(200);
    expect(deleted.body.override).toBeNull();
  });

  it('moves a workout by creating rest and training overrides without changing routine', async () => {
    const user = await registerTestUser(ctx.app);
    await createTrainingPreference(user.user.id);
    await request(ctx.app.getHttpServer())
      .put('/v1/training-schedule')
      .set(authHeader(user.accessToken))
      .send(weeklyPayload({
        MONDAY: {
          isTrainingDay: true,
          targetMusclesMode: 'CUSTOM',
          targetMuscles: ['CHEST'],
          durationMode: 'CUSTOM',
          durationMinutes: 60
        }
      }))
      .expect(200);

    const moved = await request(ctx.app.getHttpServer())
      .post('/v1/training-overrides/move-workout')
      .set(authHeader(user.accessToken))
      .send({
        fromLocalDate: '2026-06-22',
        toLocalDate: '2026-06-24'
      })
      .expect(201);

    expect(moved.body.from.overrideType).toBe('REST_DAY');
    expect(moved.body.to.overrideType).toBe('TRAINING_DAY');
    expect(moved.body.to.durationMinutes).toBe(60);
    expect(moved.body.to.targetMuscles).toEqual(['CHEST']);

    const schedule = await request(ctx.app.getHttpServer())
      .get('/v1/training-schedule')
      .set(authHeader(user.accessToken))
      .expect(200);
    const monday = schedule.body.days.find((day: { dayOfWeek: string }) => day.dayOfWeek === 'MONDAY');
    expect(monday.isTrainingDay).toBe(true);
  });

  it('stores a daily override source snapshot in newly generated daily plans', async () => {
    const user = await registerTestUser(ctx.app);
    await completeStageOne(user.accessToken);
    await createTrainingPreference(user.user.id);
    const today = todayLocalDate();

    await request(ctx.app.getHttpServer())
      .put(`/v1/training-overrides/${today}`)
      .set(authHeader(user.accessToken))
      .send({
        overrideType: 'TRAINING_DAY',
        targetMuscles: ['CHEST'],
        availableEquipment: ['BODYWEIGHT'],
        durationMinutes: 75,
        source: 'USER_SELECTED_TRAIN_TODAY'
      })
      .expect(200);

    const plan = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);

    expect(plan.body.plan.trainingScheduleSnapshot.source).toBe('DAILY_OVERRIDE');
    expect(plan.body.plan.trainingScheduleSnapshot.overrideType).toBe('TRAINING_DAY');
    expect(plan.body.plan.trainingScheduleSnapshot.durationMinutes).toBe(75);
    expect(plan.body.plan.debug.exerciseSelection.workoutDurationMinutes).toBe(75);
  });

  it('uses a daily rest override to generate a rest-day plan without exercises', async () => {
    const user = await registerTestUser(ctx.app);
    await completeStageOne(user.accessToken);
    await createTrainingPreference(user.user.id);
    const today = todayLocalDate();

    await request(ctx.app.getHttpServer())
      .put(`/v1/training-overrides/${today}`)
      .set(authHeader(user.accessToken))
      .send({
        overrideType: 'REST_DAY',
        source: 'USER_SELECTED_REST_TODAY'
      })
      .expect(200);

    const plan = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);

    expect(plan.body.plan.trainingScheduleSnapshot.source).toBe('DAILY_OVERRIDE');
    expect(plan.body.plan.trainingScheduleSnapshot.overrideType).toBe('REST_DAY');
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

function todayLocalDate() {
  return new Date().toISOString().slice(0, 10);
}
