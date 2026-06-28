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
    expect(first.body.userId).toBeUndefined();
    expect(first.body.planJson).toBeUndefined();
    expect(first.body.dailyPlanId).toBe(plan.id);
    expect(first.body.summary).toMatchObject({
      id: first.body.id,
      dailyPlanId: plan.id,
      status: WorkoutSessionStatus.IN_PROGRESS,
      plannedExerciseCount: 2,
      completedExerciseCount: 0,
      plannedSetCount: 4,
      completedSetCount: 0,
      isPartial: false
    });
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
    expect(completed.body.summary.isPartial).toBe(true);
    expect(completed.body.summary.subtitle).toBe('Partial workout saved');

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

  it('returns completed workout summaries through detail and summary endpoints', async () => {
    const user = await registerTestUser(ctx.app, 'workout-summary@example.com');
    const plan = await createDailyPlan(user.user.id, { localDate: '2026-06-25' });
    const session = await startSession(user.accessToken, plan.id);
    await completeAllProgress(user.accessToken, session);

    const completed = await request(ctx.app.getHttpServer())
      .post(`/v1/workout-sessions/${session.id}/complete`)
      .set(authHeader(user.accessToken))
      .send({})
      .expect(201);

    expect(completed.body.summary).toMatchObject({
      id: session.id,
      dailyPlanId: plan.id,
      status: WorkoutSessionStatus.COMPLETED,
      localDate: '2026-06-25',
      plannedExerciseCount: 2,
      completedExerciseCount: 2,
      plannedSetCount: 4,
      completedSetCount: 4,
      isPartial: false,
      subtitle: null
    });
    expect(completed.body.summary.primaryMuscleGroups).toEqual(['Legs', 'Glutes', 'Core']);
    expect(completed.body.planJson).toBeUndefined();
    expect(completed.body.userId).toBeUndefined();

    const summary = await request(ctx.app.getHttpServer())
      .get(`/v1/workout-sessions/${session.id}/summary`)
      .set(authHeader(user.accessToken))
      .expect(200);
    expect(summary.body).toEqual(completed.body.summary);
  });

  it('lists completed workout history newest first with limit cursor pagination', async () => {
    const user = await registerTestUser(ctx.app, 'workout-history@example.com');
    const other = await registerTestUser(ctx.app, 'workout-history-other@example.com');
    const olderPlan = await createDailyPlan(user.user.id, { localDate: '2026-06-20' });
    const newerPlan = await createDailyPlan(user.user.id, { localDate: '2026-06-21' });
    const otherPlan = await createDailyPlan(other.user.id, { localDate: '2026-06-22' });
    const older = await startSession(user.accessToken, olderPlan.id);
    const newer = await startSession(user.accessToken, newerPlan.id);
    const otherSession = await startSession(other.accessToken, otherPlan.id);

    await completePartial(user.accessToken, older.id);
    await completePartial(user.accessToken, newer.id);
    await completePartial(other.accessToken, otherSession.id);
    await ctx.prisma.workoutSession.update({
      where: { id: older.id },
      data: { completedAt: new Date('2026-06-20T10:00:00.000Z') }
    });
    await ctx.prisma.workoutSession.update({
      where: { id: newer.id },
      data: { completedAt: new Date('2026-06-21T10:00:00.000Z') }
    });

    const firstPage = await request(ctx.app.getHttpServer())
      .get('/v1/workout-sessions/history?limit=1')
      .set(authHeader(user.accessToken))
      .expect(200);
    expect(firstPage.body.items).toHaveLength(1);
    expect(firstPage.body.items[0]).toMatchObject({
      id: newer.id,
      dailyPlanId: newerPlan.id,
      status: WorkoutSessionStatus.COMPLETED,
      localDate: '2026-06-21',
      isPartial: true
    });
    expect(firstPage.body.items[0].userId).toBeUndefined();
    expect(firstPage.body.items[0].planJson).toBeUndefined();
    expect(firstPage.body.nextCursor).toBe(newer.id);

    const secondPage = await request(ctx.app.getHttpServer())
      .get(`/v1/workout-sessions/history?limit=1&cursor=${firstPage.body.nextCursor}`)
      .set(authHeader(user.accessToken))
      .expect(200);
    expect(secondPage.body.items).toHaveLength(1);
    expect(secondPage.body.items[0].id).toBe(older.id);
    expect(secondPage.body.nextCursor).toBeNull();
  });

  it('denies another user from fetching a workout summary', async () => {
    const owner = await registerTestUser(ctx.app, 'workout-summary-owner@example.com');
    const other = await registerTestUser(ctx.app, 'workout-summary-other@example.com');
    const plan = await createDailyPlan(owner.user.id);
    const session = await startSession(owner.accessToken, plan.id);

    await request(ctx.app.getHttpServer())
      .get(`/v1/workout-sessions/${session.id}/summary`)
      .set(authHeader(other.accessToken))
      .expect(404);
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
    await completePartial(user.accessToken, session.id);

    expect(session.plannedExerciseCount).toBe(1);
    expect(session.plannedSetCount).toBe(1);
    expect(session.exerciseProgress[0]).toMatchObject({
      exerciseId: null,
      exerciseSlug: null,
      exerciseNameSnapshot: 'Gentle mobility flow',
      plannedSets: null,
      plannedDurationSeconds: 480
    });

    const summary = await request(ctx.app.getHttpServer())
      .get(`/v1/workout-sessions/${session.id}/summary`)
      .set(authHeader(user.accessToken))
      .expect(200);
    expect(summary.body.title).toBe('Full Body');
  });

  async function startSession(accessToken: string, dailyPlanId: string) {
    const response = await request(ctx.app.getHttpServer())
      .post('/v1/workout-sessions')
      .set(authHeader(accessToken))
      .send({ dailyPlanId })
      .expect(201);
    return response.body;
  }

  async function completePartial(accessToken: string, sessionId: string) {
    const response = await request(ctx.app.getHttpServer())
      .post(`/v1/workout-sessions/${sessionId}/complete`)
      .set(authHeader(accessToken))
      .send({ confirmPartialCompletion: true })
      .expect(201);
    return response.body;
  }

  async function completeAllProgress(accessToken: string, session: {
    id: string;
    exerciseProgress: Array<{
      id: string;
      plannedSets: number | null;
    }>;
  }) {
    for (const progress of session.exerciseProgress) {
      if (progress.plannedSets) {
        for (let index = 0; index < progress.plannedSets; index += 1) {
          await request(ctx.app.getHttpServer())
            .patch(`/v1/workout-sessions/${session.id}/exercises/${progress.id}/sets`)
            .set(authHeader(accessToken))
            .send({ setIndex: index, completed: true })
            .expect(200);
        }
      } else {
        await request(ctx.app.getHttpServer())
          .patch(`/v1/workout-sessions/${session.id}/exercises/${progress.id}`)
          .set(authHeader(accessToken))
          .send({ isExerciseCompleted: true })
          .expect(200);
      }
    }
  }

  async function createDailyPlan(
    userId: string,
    overrides: {
      intensity?: DailyPlanJson['training']['intensity'];
      exercises?: NonNullable<DailyPlanJson['training']['exercises']>;
      localDate?: string;
    } = {}
  ) {
    const localDate = overrides.localDate ?? '2026-06-28';
    const planJson = createMockDailyPlan({
      planLocalDate: localDate,
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
        planLocalDate: overrides.localDate ?? `2026-06-28-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        planTimezone: 'UTC',
        status: PlanStatus.READY,
        readinessLevel: DailyReadinessLevel.MAINTAIN,
        planJson: planJson as unknown as Prisma.InputJsonValue,
        createdByAi: false
      }
    });
  }
});
