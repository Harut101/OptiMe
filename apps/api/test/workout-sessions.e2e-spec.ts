import request from 'supertest';
import {
  DailyReadinessLevel,
  PlanStatus,
  Prisma,
  WorkoutSessionStatus
} from '@prisma/client';

import { createMockDailyPlan } from '../src/modules/daily-plans/templates/mock-daily-plan.factory';
import type { DailyPlanJson } from '../src/modules/daily-plans/daily-plan-json.schema';
import { cleanupDatabase } from './helpers/cleanup';
import { authHeader, registerTestUser } from './helpers/auth';
import { createTestApp, TestApp } from './helpers/test-app';

describe('Workout sessions', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    delete process.env.AI_PROVIDER;
    ctx = await createTestApp();
  });

  beforeEach(async () => cleanupDatabase(ctx.prisma));

  afterAll(async () => {
    await cleanupDatabase(ctx.prisma);
    await ctx.app.close();
  });

  it('starts a session idempotently and snapshots planned exercises', async () => {
    const user = await registerTestUser(ctx.app, 'workout-start@example.com');
    const plan = await createDailyPlan(user.user.id);

    const first = await request(ctx.app.getHttpServer())
      .post('/v1/workout-sessions')
      .set(authHeader(user.accessToken))
      .send({ dailyPlanId: plan.id })
      .expect(201);

    expect(first.body.status).toBe(WorkoutSessionStatus.IN_PROGRESS);
    expect(first.body.dailyPlanId).toBe(plan.id);
    expect(first.body.plannedExerciseCount).toBe(2);
    expect(first.body.completedExerciseCount).toBe(0);
    expect(first.body.plannedSetCount).toBe(4);
    expect(first.body.completedSetCount).toBe(0);
    expect(first.body.progressPercent).toBe(0);
    expect(first.body.exerciseProgress).toHaveLength(2);
    expect(first.body.exerciseProgress[0]).toMatchObject({
      planExerciseOrder: 0,
      exerciseId: 'exercise-squat',
      exerciseSlug: 'bodyweight-squat',
      exerciseNameSnapshot: 'Bodyweight squat',
      plannedSets: 3,
      plannedReps: '10-12',
      completedSetIndexes: [],
      isExerciseCompleted: false
    });
    expect(first.body.exerciseProgress[1]).toMatchObject({
      planExerciseOrder: 1,
      exerciseNameSnapshot: 'Plank hold',
      plannedSets: null,
      plannedDurationSeconds: 60,
      isExerciseCompleted: false
    });

    const second = await request(ctx.app.getHttpServer())
      .post('/v1/workout-sessions')
      .set(authHeader(user.accessToken))
      .send({ dailyPlanId: plan.id })
      .expect(201);

    expect(second.body.id).toBe(first.body.id);
    expect(second.body.exerciseProgress).toHaveLength(2);
  });

  it('rejects rest plans and plans without exercises', async () => {
    const user = await registerTestUser(ctx.app, 'workout-rest@example.com');
    const restPlan = await createDailyPlan(user.user.id, {
      intensity: 'REST',
      exercises: []
    });

    await request(ctx.app.getHttpServer())
      .post('/v1/workout-sessions')
      .set(authHeader(user.accessToken))
      .send({ dailyPlanId: restPlan.id })
      .expect(400);
  });

  it('keeps workout sessions scoped to the owning user', async () => {
    const owner = await registerTestUser(ctx.app, 'workout-owner@example.com');
    const other = await registerTestUser(ctx.app, 'workout-other@example.com');
    const plan = await createDailyPlan(owner.user.id);

    const session = await request(ctx.app.getHttpServer())
      .post('/v1/workout-sessions')
      .set(authHeader(owner.accessToken))
      .send({ dailyPlanId: plan.id })
      .expect(201);

    await request(ctx.app.getHttpServer())
      .post('/v1/workout-sessions')
      .set(authHeader(other.accessToken))
      .send({ dailyPlanId: plan.id })
      .expect(404);

    await request(ctx.app.getHttpServer())
      .get(`/v1/workout-sessions/${session.body.id}`)
      .set(authHeader(other.accessToken))
      .expect(404);
  });

  it('toggles sets, validates set indexes, and supports no-set exercise completion', async () => {
    const user = await registerTestUser(ctx.app, 'workout-toggle@example.com');
    const plan = await createDailyPlan(user.user.id);
    const session = await startSession(user.accessToken, plan.id);
    const squat = session.exerciseProgress[0];
    const plank = session.exerciseProgress[1];

    const oneSetDone = await request(ctx.app.getHttpServer())
      .patch(`/v1/workout-sessions/${session.id}/exercises/${squat.id}/sets`)
      .set(authHeader(user.accessToken))
      .send({ setIndex: 0, completed: true })
      .expect(200);
    expect(oneSetDone.body.completedSetCount).toBe(1);
    expect(oneSetDone.body.exerciseProgress[0].completedSetIndexes).toEqual([0]);
    expect(oneSetDone.body.exerciseProgress[0].isExerciseCompleted).toBe(false);

    const setUndone = await request(ctx.app.getHttpServer())
      .patch(`/v1/workout-sessions/${session.id}/exercises/${squat.id}/sets`)
      .set(authHeader(user.accessToken))
      .send({ setIndex: 0, completed: false })
      .expect(200);
    expect(setUndone.body.completedSetCount).toBe(0);
    expect(setUndone.body.exerciseProgress[0].completedSetIndexes).toEqual([]);

    await request(ctx.app.getHttpServer())
      .patch(`/v1/workout-sessions/${session.id}/exercises/${squat.id}/sets`)
      .set(authHeader(user.accessToken))
      .send({ setIndex: 4, completed: true })
      .expect(400);

    await request(ctx.app.getHttpServer())
      .patch(`/v1/workout-sessions/${session.id}/exercises/${squat.id}/sets`)
      .set(authHeader(user.accessToken))
      .send({ setIndex: 0, completed: true })
      .expect(200);
    await request(ctx.app.getHttpServer())
      .patch(`/v1/workout-sessions/${session.id}/exercises/${squat.id}/sets`)
      .set(authHeader(user.accessToken))
      .send({ setIndex: 1, completed: true })
      .expect(200);
    const allSetsDone = await request(ctx.app.getHttpServer())
      .patch(`/v1/workout-sessions/${session.id}/exercises/${squat.id}/sets`)
      .set(authHeader(user.accessToken))
      .send({ setIndex: 2, completed: true })
      .expect(200);
    expect(allSetsDone.body.completedSetCount).toBe(3);
    expect(allSetsDone.body.exerciseProgress[0].isExerciseCompleted).toBe(true);

    const plankDone = await request(ctx.app.getHttpServer())
      .patch(`/v1/workout-sessions/${session.id}/exercises/${plank.id}`)
      .set(authHeader(user.accessToken))
      .send({ isExerciseCompleted: true })
      .expect(200);
    expect(plankDone.body.completedSetCount).toBe(4);
    expect(plankDone.body.completedExerciseCount).toBe(2);
    expect(plankDone.body.progressPercent).toBe(100);
  });

  it('requires confirmation for partial completion and makes completed sessions read-only', async () => {
    const user = await registerTestUser(ctx.app, 'workout-complete@example.com');
    const plan = await createDailyPlan(user.user.id);
    const session = await startSession(user.accessToken, plan.id);
    const squat = session.exerciseProgress[0];

    await request(ctx.app.getHttpServer())
      .post(`/v1/workout-sessions/${session.id}/complete`)
      .set(authHeader(user.accessToken))
      .send({})
      .expect(400);

    const completed = await request(ctx.app.getHttpServer())
      .post(`/v1/workout-sessions/${session.id}/complete`)
      .set(authHeader(user.accessToken))
      .send({ confirmPartialCompletion: true })
      .expect(201);
    expect(completed.body.status).toBe(WorkoutSessionStatus.COMPLETED);
    expect(completed.body.completedAt).toEqual(expect.any(String));

    const completedAgain = await request(ctx.app.getHttpServer())
      .post(`/v1/workout-sessions/${session.id}/complete`)
      .set(authHeader(user.accessToken))
      .send({ confirmPartialCompletion: true })
      .expect(201);
    expect(completedAgain.body.completedAt).toBe(completed.body.completedAt);

    await request(ctx.app.getHttpServer())
      .patch(`/v1/workout-sessions/${session.id}/exercises/${squat.id}/sets`)
      .set(authHeader(user.accessToken))
      .send({ setIndex: 0, completed: true })
      .expect(400);
  });

  it('supports legacy free-text plan exercises without library ids', async () => {
    const user = await registerTestUser(ctx.app, 'workout-legacy@example.com');
    const plan = await createDailyPlan(user.user.id, {
      exercises: [
        {
          name: 'Gentle mobility flow',
          targetMuscles: ['full body'],
          equipment: ['bodyweight'],
          duration: '8 minutes',
          intensityCue: 'Easy and smooth.',
          safetyNotes: 'Keep it comfortable.'
        }
      ]
    });

    const session = await startSession(user.accessToken, plan.id);

    expect(session.plannedExerciseCount).toBe(1);
    expect(session.plannedSetCount).toBe(1);
    expect(session.exerciseProgress[0]).toMatchObject({
      exerciseId: null,
      exerciseSlug: null,
      exerciseNameSnapshot: 'Gentle mobility flow',
      plannedSets: null,
      plannedDurationSeconds: 480
    });
  });

  async function startSession(accessToken: string, dailyPlanId: string) {
    const response = await request(ctx.app.getHttpServer())
      .post('/v1/workout-sessions')
      .set(authHeader(accessToken))
      .send({ dailyPlanId })
      .expect(201);
    return response.body;
  }

  async function createDailyPlan(
    userId: string,
    overrides: {
      intensity?: DailyPlanJson['training']['intensity'];
      exercises?: NonNullable<DailyPlanJson['training']['exercises']>;
    } = {}
  ) {
    const planJson = createMockDailyPlan({
      planLocalDate: '2026-06-28',
      planTimezone: 'UTC',
      isMinor: false
    });

    planJson.training.intensity = overrides.intensity ?? 'MODERATE';
    planJson.training.exercises = overrides.exercises ?? [
      {
        exerciseId: 'exercise-squat',
        slug: 'bodyweight-squat',
        name: 'Bodyweight squat',
        targetMuscles: ['legs', 'glutes'],
        equipment: ['bodyweight'],
        sets: '3',
        reps: '10-12',
        rest: '90 seconds',
        intensityCue: 'Move with control.',
        safetyNotes: 'Use a pain-free range.'
      },
      {
        name: 'Plank hold',
        targetMuscles: ['core'],
        equipment: ['bodyweight'],
        duration: '60 seconds',
        intensityCue: 'Keep breathing steady.',
        safetyNotes: 'Stop if your back feels uncomfortable.'
      }
    ];

    return ctx.prisma.dailyPlan.create({
      data: {
        userId,
        planLocalDate: `2026-06-28-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        planTimezone: 'UTC',
        status: PlanStatus.READY,
        readinessLevel: DailyReadinessLevel.MAINTAIN,
        planJson: planJson as unknown as Prisma.InputJsonValue,
        createdByAi: false
      }
    });
  }
});
