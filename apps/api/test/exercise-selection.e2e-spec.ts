import request from 'supertest';
import {
  ExerciseEquipment,
  PlanStatus,
  PlanQualityMode,
  PregnancyStatus,
  PreferredLocale,
  TargetMuscleGroup,
  TrainingLevel
} from '@prisma/client';

import { seedExerciseCatalog } from '../prisma/seeds/exercises/seed';
import { createMockDailyPlan } from '../src/modules/daily-plans/templates/mock-daily-plan.factory';
import {
  composeDeterministicFallbackWorkout,
  validateAndNormalizePlannedExercises
} from '../src/modules/exercise-selection/exercise-plan-validator';
import { ExerciseSelectionService } from '../src/modules/exercise-selection/exercise-selection.service';
import type { ExerciseSelectionContext } from '../src/modules/exercise-selection/exercise-selection.types';
import { normalizeLegacyTargetMuscles } from '../src/modules/exercise-selection/legacy-muscle-normalizer';
import { trainingProtocols } from '../src/modules/protocol/training-protocols';
import { TrainingPlanAgentService } from '../src/modules/training-plan-agent/training-plan-agent.service';
import { authHeader, registerTestUser } from './helpers/auth';
import { cleanupDatabase } from './helpers/cleanup';
import { createTestApp, TestApp } from './helpers/test-app';

describe('ExerciseSelection and library-backed Daily Plans', () => {
  let ctx: TestApp;
  let service: ExerciseSelectionService;
  let trainingPlanAgent: TrainingPlanAgentService;

  beforeAll(async () => {
    delete process.env.AI_PROVIDER;
    ctx = await createTestApp();
    await seedExerciseCatalog(ctx.prisma);
    service = ctx.app.get(ExerciseSelectionService);
    trainingPlanAgent = ctx.app.get(TrainingPlanAgentService);
  });

  beforeEach(async () => cleanupDatabase(ctx.prisma));
  afterAll(async () => {
    await cleanupDatabase(ctx.prisma);
    await ctx.app.close();
  });

  it('returns deterministic ranked candidates with exact target coverage', async () => {
    const context = baseContext({
      availableEquipment: [ExerciseEquipment.MACHINES],
      targetMuscles: [TargetMuscleGroup.QUADRICEPS, TargetMuscleGroup.GLUTES]
    });
    const first = await service.selectCandidates(context);
    const second = await service.selectCandidates(context);
    expect(first).toEqual(second);
    expect(first.candidates[0].targetMuscles.some((muscle) => context.targetMuscles.includes(muscle))).toBe(true);
    expect(first.candidates.every((candidate) => candidate.exerciseId && candidate.slug)).toBe(true);
    expect(first.candidates.length).toBeLessThanOrEqual(16);
  });

  it('normalizes legacy muscle groups without mutating specific values', () => {
    expect(normalizeLegacyTargetMuscles([TargetMuscleGroup.ARMS])).toEqual([
      TargetMuscleGroup.BICEPS, TargetMuscleGroup.TRICEPS, TargetMuscleGroup.FOREARMS
    ]);
    expect(normalizeLegacyTargetMuscles([TargetMuscleGroup.BACK])).toEqual([
      TargetMuscleGroup.TRAPS, TargetMuscleGroup.LATS, TargetMuscleGroup.LOWER_BACK
    ]);
    expect(normalizeLegacyTargetMuscles([TargetMuscleGroup.CORE])).toEqual([
      TargetMuscleGroup.ABS, TargetMuscleGroup.OBLIQUES
    ]);
    expect(normalizeLegacyTargetMuscles([TargetMuscleGroup.LEGS])).toEqual([
      TargetMuscleGroup.GLUTES, TargetMuscleGroup.QUADRICEPS, TargetMuscleGroup.HAMSTRINGS,
      TargetMuscleGroup.ADDUCTORS, TargetMuscleGroup.ABDUCTORS, TargetMuscleGroup.CALVES
    ]);
    expect(normalizeLegacyTargetMuscles([TargetMuscleGroup.CHEST])).toEqual([TargetMuscleGroup.CHEST]);
  });

  it('uses bodyweight/NONE only when no concrete equipment is saved', async () => {
    const result = await service.selectCandidates(baseContext({ availableEquipment: [] }));
    const universallyAvailable = new Set<ExerciseEquipment>([
      ExerciseEquipment.BODYWEIGHT,
      ExerciseEquipment.NONE
    ]);
    expect(result.fallbackMode).toBe('BODYWEIGHT_ONLY');
    expect(result.candidates.every((candidate) =>
      candidate.equipment.every((item) => universallyAvailable.has(item))
    )).toBe(true);
  });

  it('keeps beginner eligibility conservative and applies pregnancy review exclusions', async () => {
    const beginner = await service.selectCandidates(baseContext({
      availableEquipment: [ExerciseEquipment.BARBELL, ExerciseEquipment.DUMBBELLS, ExerciseEquipment.BENCH],
      trainingLevel: TrainingLevel.BEGINNER
    }));
    expect(beginner.candidates.map((candidate) => candidate.slug)).not.toContain('romanian-deadlift');

    const pregnant = await service.selectCandidates(baseContext({ pregnancyStatus: PregnancyStatus.PREGNANT }));
    expect(pregnant.candidates.map((candidate) => candidate.slug)).not.toContain('glute-bridge');
    expect(pregnant.internalExclusionSummary.PREGNANCY_REVIEW_REQUIRED).toBeGreaterThan(0);
  });

  it('sizes exercise count by duration and reduces volume for recovery signals', async () => {
    const normalContext = {
      availableEquipment: allExerciseEquipment(),
      trainingLevel: TrainingLevel.INTERMEDIATE,
      targetMuscles: []
    };
    const counts = await Promise.all([20, 30, 45, 60, 75, 90].map(async (duration) =>
      (await service.selectCandidates(baseContext({ ...normalContext, workoutDurationMinutes: duration }))).requestedExerciseCount
    ));
    expect(counts).toEqual([2, 4, 5, 6, 7, 8]);

    const sixtyMinute = await service.selectCandidates(baseContext({ ...normalContext, workoutDurationMinutes: 60 }));
    expect(sixtyMinute.volumePlan).toMatchObject({
      minExerciseCount: 5,
      maxExerciseCount: 6,
      suggestedSetsPerExercise: 3
    });
    expect(sixtyMinute.volumePlan.suggestedRestSeconds).toBeGreaterThanOrEqual(60);

    const lowSleep = await service.selectCandidates(baseContext({
      workoutDurationMinutes: 45,
      targetMuscles: [],
      healthSignals: { lowSleep: true, highActivity: false, lowStepTrend: false }
    }));
    expect(lowSleep.requestedExerciseCount).toBe(4);
    expect(['MOBILITY', 'RECOVERY']).toContain(lowSleep.candidates[0].category);
  });

  it('reduces volume safely when candidate pool is smaller than duration target', async () => {
    const plannerResult = await service.selectCandidates(baseContext({
      workoutDurationMinutes: 90,
      availableEquipment: [],
      trainingLevel: TrainingLevel.ADVANCED,
      targetMuscles: [TargetMuscleGroup.CHEST]
    }));

    expect(plannerResult.requestedExerciseCount).toBeLessThanOrEqual(plannerResult.candidates.length);
    if (plannerResult.candidates.length < 8) {
      expect(plannerResult.volumePlan.volumeReasonCodes).toContain('NOT_ENOUGH_SAFE_EXERCISES');
    }
  });

  it('excludes inactive records and adjusts conservatively for high activity', async () => {
    const walking = await ctx.prisma.exercise.findFirstOrThrow({ where: { slug: 'walking' } });
    await ctx.prisma.exercise.update({ where: { id: walking.id }, data: { isActive: false } });
    try {
      const inactive = await service.selectCandidates(baseContext({
        protocol: trainingProtocols.ENDURANCE,
        targetMuscles: []
      }));
      expect(inactive.candidates.map((candidate) => candidate.slug)).not.toContain('walking');

      const highActivity = await service.selectCandidates(baseContext({
        workoutDurationMinutes: 45,
        targetMuscles: [],
        healthSignals: { lowSleep: false, highActivity: true, lowStepTrend: false }
      }));
      expect(highActivity.requestedExerciseCount).toBe(4);
      expect(['MOBILITY', 'RECOVERY']).toContain(highActivity.candidates[0].category);
    } finally {
      await ctx.prisma.exercise.update({ where: { id: walking.id }, data: { isActive: true } });
    }
  });

  it('promotes accessible movement for low-step trend without raw health values', async () => {
    const result = await service.selectCandidates(baseContext({
      protocol: trainingProtocols.ENDURANCE,
      targetMuscles: [],
      healthSignals: { lowSleep: false, highActivity: false, lowStepTrend: true }
    }));
    expect(result.candidates.some((candidate) =>
      candidate.internalReasonCodes.includes('LOW_STEP_ACCESSIBLE_MOVEMENT')
    )).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/stepCount|sleepHours|heartRate|weightKg/);
  });

  it.each(['en-US', 'ru-RU', 'fr-FR', 'zh-CN'] as const)(
    'resolves localized snapshots for %s',
    async (locale) => {
      const result = await service.selectCandidates(baseContext({ locale }));
      expect(result.candidates).not.toHaveLength(0);
      expect(result.candidates.every((candidate) => candidate.resolvedLocale === locale)).toBe(true);
    }
  );

  it('resolves localized candidates and deterministic English fallback', async () => {
    const russian = await service.selectCandidates(baseContext({ locale: 'ru-RU' }));
    expect(russian.candidates.every((candidate) => candidate.resolvedLocale === 'ru-RU')).toBe(true);

    const exercise = await ctx.prisma.exercise.findFirstOrThrow({ where: { slug: 'walking' } });
    const ru = await ctx.prisma.exerciseTranslation.findUniqueOrThrow({
      where: { exerciseId_locale: { exerciseId: exercise.id, locale: PreferredLocale.RU_RU } }
    });
    await ctx.prisma.exerciseTranslation.delete({ where: { id: ru.id } });
    try {
      const fallback = await service.selectCandidates(baseContext({ locale: 'ru-RU', protocol: trainingProtocols.ENDURANCE }));
      expect(fallback.candidates.find((candidate) => candidate.slug === 'walking')?.resolvedLocale).toBe('en-US');
    } finally {
      await ctx.prisma.exerciseTranslation.create({
        data: {
          id: ru.id,
          exerciseId: ru.exerciseId,
          locale: ru.locale,
          name: ru.name,
          instructions: ru.instructions,
          coachingCues: ru.coachingCues,
          safetyNotes: ru.safetyNotes
        }
      });
    }
  });

  it('rejects unlisted identities and uses a deterministic trusted fallback snapshot', async () => {
    const selection = await service.selectCandidates(baseContext());
    const plan = createMockDailyPlan({ planLocalDate: '2026-06-20', planTimezone: 'UTC', isMinor: false });
    plan.training.exercises = Array.from({ length: selection.requestedExerciseCount }, (_, index) => ({
      exerciseId: `invented-${index}`,
      slug: `invented-${index}`,
      name: 'Invented move',
      targetMuscles: [],
      equipment: [],
      sets: '2',
      reps: '8-10',
      rest: '60 seconds'
    }));
    const invalid = validateAndNormalizePlannedExercises(plan, selection);
    expect(invalid).toMatchObject({ valid: false });
    if (!invalid.valid) expect(invalid.reasonCodes).toContain('EXERCISE_NOT_ALLOWED');

    const fallback = composeDeterministicFallbackWorkout(plan, selection);
    expect(fallback.training.exercises).toHaveLength(selection.requestedExerciseCount);
    expect(fallback.training.exercises?.every((item) =>
      selection.candidates.some((candidate) => candidate.exerciseId === item.exerciseId) && item.exerciseSnapshot
    )).toBe(true);
  });

  it('rejects an underfilled long workout and returns a bounded timing repair brief', async () => {
    const selection = await service.selectCandidates(baseContext({
      workoutDurationMinutes: 60,
      availableEquipment: allExerciseEquipment(),
      trainingLevel: TrainingLevel.INTERMEDIATE,
      targetMuscles: []
    }));
    const plan = createMockDailyPlan({ planLocalDate: '2026-06-20', planTimezone: 'UTC', isMinor: false });
    plan.training.exercises = selection.candidates.slice(0, selection.requestedExerciseCount).map((candidate) => ({
      exerciseId: candidate.exerciseId,
      slug: candidate.slug,
      name: candidate.name,
      targetMuscles: candidate.targetMuscles,
      equipment: candidate.equipment,
      sets: '1',
      reps: '1',
      rest: '15 seconds'
    }));

    const invalid = validateAndNormalizePlannedExercises(plan, selection);
    expect(invalid).toMatchObject({ valid: false });
    if (!invalid.valid) {
      expect(invalid.reasonCodes).toContain('SESSION_DURATION_TOO_SHORT');
      expect(invalid.repairFeedback.sessionTiming).toMatchObject({
        targetMinutes: 60,
        suggestedSetsPerExercise: 3,
        suggestedRestSeconds: 75
      });
      expect(invalid.repairFeedback.instructions).toEqual(
        expect.arrayContaining([expect.stringContaining('full session')])
      );
    }
  });

  it('accepts one corrected AI training plan through the TrainingPlanAgent boundary', async () => {
    const selection = await trainingPlanAgent.selectCandidates(baseContext());
    const invalidPlan = createInventedExercisePlan(selection.requestedExerciseCount);
    const correctedPlan = trainingPlanAgent.composeDeterministicFallback(
      createMockDailyPlan({
        planLocalDate: '2026-06-20',
        planTimezone: 'UTC',
        isMinor: false
      }),
      selection
    );
    const retry = jest.fn().mockResolvedValue({
      status: PlanStatus.READY,
      planJson: correctedPlan
    });

    const result = await trainingPlanAgent.finalizeGeneratedPlan({
      providerPlanResult: { status: PlanStatus.READY, planJson: invalidPlan },
      exerciseSelection: selection,
      retry
    });

    expect(retry).toHaveBeenCalledTimes(1);
    expect(retry).toHaveBeenCalledWith(expect.objectContaining({
      reasonCodes: expect.arrayContaining(['EXERCISE_NOT_ALLOWED'])
    }));
    expect(result).toMatchObject({
      status: PlanStatus.READY,
      usedAiRetry: true,
      usedDeterministicFallback: false
    });
  });

  it('uses a trusted library fallback when the TrainingPlanAgent retry is still invalid', async () => {
    const selection = await trainingPlanAgent.selectCandidates(baseContext());
    const invalidPlan = createInventedExercisePlan(selection.requestedExerciseCount);

    const result = await trainingPlanAgent.finalizeGeneratedPlan({
      providerPlanResult: { status: PlanStatus.READY, planJson: invalidPlan },
      exerciseSelection: selection,
      retry: async () => ({ status: PlanStatus.READY, planJson: invalidPlan })
    });

    expect(result.usedAiRetry).toBe(true);
    expect(result.usedDeterministicFallback).toBe(true);
    expect(result.planJson.training.exercises).toHaveLength(selection.requestedExerciseCount);
    expect(result.planJson.training.exercises?.every((exercise) =>
      selection.candidates.some((candidate) => candidate.exerciseId === exercise.exerciseId)
    )).toBe(true);
  });

  it('stores library identities and immutable localized snapshots for a gym beginner leg plan', async () => {
    const user = await setupUser('selection-gym@example.com');
    await saveTrainingPreference(user.accessToken, {
      targetMuscleGroups: ['QUADRICEPS', 'GLUTES'], equipment: ['GYM', 'MACHINES'], trainingLevel: 'BEGINNER'
    });
    const generated = await generate(user.accessToken);
    expect(generated.body.status).toBe('READY');
    const exercises = generated.body.plan.training.exercises as Array<Record<string, unknown>>;
    expect(exercises.length).toBeGreaterThan(0);
    expect(exercises.every((item) => item.exerciseId && item.slug && item.name && item.exerciseSnapshot)).toBe(true);
    expect(exercises.every((item) => !(item.equipment as string[]).includes('DUMBBELLS'))).toBe(true);
  });

  it('generates fuller library-backed workouts for longer normal strength sessions', async () => {
    const sixty = await setupUser('selection-60-min@example.com', 60);
    await saveTrainingPreference(sixty.accessToken, {
      targetMuscleGroups: ['QUADRICEPS', 'GLUTES'],
      equipment: ['GYM', 'DUMBBELLS', 'MACHINES'],
      trainingLevel: 'INTERMEDIATE'
    });
    const sixtyPlan = await generate(sixty.accessToken);
    expect(sixtyPlan.body.plan.training.exercises).toHaveLength(6);
    expect(sixtyPlan.body.plan.debug.exerciseSelection.requestedExerciseCount).toBe(6);

    const ninety = await setupUser('selection-90-min@example.com', 90);
    await saveTrainingPreference(ninety.accessToken, {
      targetMuscleGroups: ['FULL_BODY'],
      equipment: ['GYM', 'DUMBBELLS', 'MACHINES'],
      trainingLevel: 'INTERMEDIATE'
    });
    const ninetyPlan = await generate(ninety.accessToken);
    expect(ninetyPlan.body.plan.training.exercises.length).toBeGreaterThanOrEqual(7);
    expect(ninetyPlan.body.plan.debug.exerciseSelection.requestedExerciseCount).toBeGreaterThanOrEqual(7);
  });

  it('keeps home bodyweight plans free of machine exercises and expands legacy LEGS', async () => {
    const user = await setupUser('selection-home@example.com');
    await saveTrainingPreference(user.accessToken, {
      targetMuscleGroups: ['LEGS'], equipment: ['HOME', 'BODYWEIGHT'], trainingLevel: 'BEGINNER'
    });
    const generated = await generate(user.accessToken);
    const exercises = generated.body.plan.training.exercises as Array<{ equipment: string[]; exerciseSnapshot: { targetMuscles: string[] } }>;
    expect(exercises.every((item) => item.equipment.every((equipment) => ['BODYWEIGHT', 'NONE'].includes(equipment)))).toBe(true);
    expect(exercises.flatMap((item) => item.exerciseSnapshot.targetMuscles)).not.toContain('LEGS');
  });

  it('stores the preferred locale snapshot and does not mutate it after library edits', async () => {
    const user = await setupUser('selection-locale@example.com');
    await request(ctx.app.getHttpServer()).put('/v1/settings').set(authHeader(user.accessToken))
      .send({ preferredLocale: 'fr-FR' }).expect(200);
    const generated = await generate(user.accessToken);
    const exercise = generated.body.plan.training.exercises[0];
    expect(exercise.exerciseSnapshot.resolvedLocale).toBe('fr-FR');
    const storedBefore = await ctx.prisma.dailyPlan.findFirstOrThrow({ where: { userId: user.user.id } });
    const translation = await ctx.prisma.exerciseTranslation.findUniqueOrThrow({
      where: { exerciseId_locale: { exerciseId: exercise.exerciseId, locale: PreferredLocale.FR_FR } }
    });
    await ctx.prisma.exerciseTranslation.update({ where: { id: translation.id }, data: { name: `${translation.name} updated` } });
    try {
      const today = await request(ctx.app.getHttpServer()).get('/v1/daily-plans/today')
        .set(authHeader(user.accessToken)).expect(200);
      expect(today.body.plan.training.exercises[0].name).toBe(exercise.name);
      expect((await ctx.prisma.dailyPlan.findUniqueOrThrow({ where: { id: storedBefore.id } })).planJson).toEqual(storedBefore.planJson);
    } finally {
      await ctx.prisma.exerciseTranslation.update({ where: { id: translation.id }, data: { name: translation.name } });
    }
  });

  async function setupUser(email: string, durationMinutes = 30) {
    const user = await registerTestUser(ctx.app, email);
    const headers = authHeader(user.accessToken);
    await request(ctx.app.getHttpServer()).put('/v1/profile').set(headers).send({
      firstName: 'Selection', lastName: 'User', gender: 'female', dateOfBirth: '1990-01-01',
      heightCm: 170, weightKg: 70, activityLevel: 'MODERATE', privacyConsentAccepted: true
    }).expect(200);
    await request(ctx.app.getHttpServer()).put('/v1/goals').set(headers).send({ goalType: 'IMPROVE_FITNESS' }).expect(200);
    await request(ctx.app.getHttpServer()).put('/v1/nutrition-preferences').set(headers)
      .send({ noKnownAllergiesConfirmed: true }).expect(200);
    await request(ctx.app.getHttpServer()).post('/v1/training-schedule/items').set(headers).send({
      dayOfWeek: new Date().getUTCDay(), localTime: '08:00', sportType: 'STRENGTH',
      durationMinutes, intensity: 'MODERATE', description: 'Controlled training'
    }).expect(201);
    return user;
  }

  function saveTrainingPreference(token: string, body: Record<string, unknown>) {
    return request(ctx.app.getHttpServer()).put('/v1/training-preferences')
      .set(authHeader(token)).send(body).expect(200);
  }

  function generate(token: string) {
    return request(ctx.app.getHttpServer()).post('/v1/daily-plans/generate')
      .set(authHeader(token)).send({ forceRegenerate: true }).expect(201);
  }
});

function baseContext(overrides: Partial<ExerciseSelectionContext> = {}): ExerciseSelectionContext {
  return {
    locale: 'en-US', planDate: '2026-06-20', protocol: trainingProtocols.STRENGTH,
    availableEquipment: [], trainingLevel: TrainingLevel.BEGINNER,
    targetMuscles: [TargetMuscleGroup.QUADRICEPS], workoutDurationMinutes: 30,
    limitationsPresent: false, pregnancyStatus: PregnancyStatus.NOT_PREGNANT,
    safeMode: false, isMinor: false,
    healthSignals: { lowSleep: false, highActivity: false, lowStepTrend: false },
    qualityMode: PlanQualityMode.PERSONALIZED,
    ...overrides
  };
}

function allExerciseEquipment() {
  return [
    ExerciseEquipment.BODYWEIGHT,
    ExerciseEquipment.DUMBBELLS,
    ExerciseEquipment.BARBELL,
    ExerciseEquipment.BENCH,
    ExerciseEquipment.MACHINES,
    ExerciseEquipment.CABLE_MACHINE,
    ExerciseEquipment.PULL_UP_BAR,
    ExerciseEquipment.KETTLEBELL,
    ExerciseEquipment.RESISTANCE_BANDS,
    ExerciseEquipment.CARDIO_MACHINE
  ];
}

function createInventedExercisePlan(exerciseCount: number) {
  const plan = createMockDailyPlan({
    planLocalDate: '2026-06-20',
    planTimezone: 'UTC',
    isMinor: false
  });
  plan.training.exercises = Array.from({ length: exerciseCount }, (_, index) => ({
    exerciseId: `invented-${index}`,
    slug: `invented-${index}`,
    name: 'Invented move',
    targetMuscles: [],
    equipment: [],
    sets: '2',
    reps: '8-10',
    rest: '60 seconds'
  }));
  return plan;
}
