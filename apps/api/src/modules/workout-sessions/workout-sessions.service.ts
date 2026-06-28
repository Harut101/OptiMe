import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common';
import { Prisma, WorkoutSessionStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { normalizeDailyPlanJson } from '../daily-plans/daily-plan-normalizer';
import { CompleteWorkoutSessionDto } from './dto/complete-workout-session.dto';
import { StartWorkoutSessionDto } from './dto/start-workout-session.dto';
import { ToggleWorkoutSetDto } from './dto/toggle-workout-set.dto';
import { UpdateWorkoutExerciseProgressDto } from './dto/update-workout-exercise-progress.dto';
import { WorkoutHistoryQueryDto } from './dto/workout-history-query.dto';

type WorkoutSessionWithProgress = Prisma.WorkoutSessionGetPayload<{
  include: { exerciseProgress: true; dailyPlan: true };
}>;

interface PlannedWorkoutExercise {
  planExerciseKey: string;
  planExerciseOrder: number;
  exerciseId: string | null;
  exerciseSlug: string | null;
  exerciseNameSnapshot: string;
  plannedSets: number | null;
  plannedReps: string | null;
  plannedDurationSeconds: number | null;
  plannedRestSeconds: number | null;
}

interface PlanExerciseForExecution {
  name: string;
  exerciseId?: string;
  slug?: string;
  sets?: string;
  reps?: string;
  duration?: string;
  rest?: string;
}

@Injectable()
export class WorkoutSessionsService {
  private readonly logger = new Logger(WorkoutSessionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async start(userId: string, dto: StartWorkoutSessionDto) {
    const existing = await this.findByPlan(userId, dto.dailyPlanId);
    if (existing) return this.toResponse(existing);

    const plan = await this.getOwnedDailyPlan(userId, dto.dailyPlanId);
    const plannedExercises = this.snapshotPlannedExercises(plan);

    if (!plannedExercises.length) {
      throw new BadRequestException('Workout is unavailable for this plan.');
    }

    const plannedSetCount = plannedExercises.reduce(
      (sum, exercise) => sum + this.getPlannedUnitCount(exercise),
      0
    );

    try {
      const session = await this.prisma.workoutSession.create({
        data: {
          userId,
          dailyPlanId: dto.dailyPlanId,
          plannedExerciseCount: plannedExercises.length,
          completedExerciseCount: 0,
          plannedSetCount,
          completedSetCount: 0,
          exerciseProgress: {
            create: plannedExercises.map((exercise) => ({
              planExerciseKey: exercise.planExerciseKey,
              planExerciseOrder: exercise.planExerciseOrder,
              exerciseId: exercise.exerciseId,
              exerciseSlug: exercise.exerciseSlug,
              exerciseNameSnapshot: exercise.exerciseNameSnapshot,
              plannedSets: exercise.plannedSets,
              plannedReps: exercise.plannedReps,
              plannedDurationSeconds: exercise.plannedDurationSeconds,
              plannedRestSeconds: exercise.plannedRestSeconds,
              completedSetIndexes: [],
              isExerciseCompleted: false
            }))
          }
        },
        include: { exerciseProgress: true, dailyPlan: true }
      });

      this.logger.log(
        `workout session started; sessionId=${session.id}; dailyPlanId=${dto.dailyPlanId}; plannedExercises=${session.plannedExerciseCount}; plannedSets=${session.plannedSetCount}`
      );

      return this.toResponse(session);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        const racedSession = await this.findByPlan(userId, dto.dailyPlanId);
        if (racedSession) return this.toResponse(racedSession);
      }

      throw error;
    }
  }

  async getByPlan(userId: string, dailyPlanId: string) {
    await this.getOwnedDailyPlan(userId, dailyPlanId);
    const session = await this.findByPlan(userId, dailyPlanId);
    return session ? this.toResponse(session) : null;
  }

  async getById(userId: string, sessionId: string) {
    return this.toResponse(await this.getOwnedSession(userId, sessionId));
  }

  async getHistory(userId: string, query: WorkoutHistoryQueryDto) {
    const limit = query.limit ?? 20;
    const sessions = await this.prisma.workoutSession.findMany({
      where: {
        userId,
        status: WorkoutSessionStatus.COMPLETED
      },
      orderBy: [
        { completedAt: 'desc' },
        { updatedAt: 'desc' },
        { id: 'desc' }
      ],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: { exerciseProgress: true, dailyPlan: true }
    });
    const items = sessions.slice(0, limit);
    const nextCursor = sessions.length > limit ? items[items.length - 1]?.id ?? null : null;

    this.logger.log(
      `workout history fetched; count=${items.length}; hasNext=${Boolean(nextCursor)}`
    );

    return {
      items: items.map((session) => this.toSummary(session)),
      nextCursor
    };
  }

  async getSummary(userId: string, sessionId: string) {
    return this.toSummary(await this.getOwnedSession(userId, sessionId));
  }

  async toggleSet(
    userId: string,
    sessionId: string,
    progressId: string,
    dto: ToggleWorkoutSetDto
  ) {
    const session = await this.getOwnedSession(userId, sessionId);
    this.assertMutable(session);
    const progress = this.getProgressOrThrow(session, progressId);

    if (progress.plannedSets === null) {
      throw new BadRequestException('This exercise uses exercise-level completion.');
    }

    if (dto.setIndex < 0 || dto.setIndex >= progress.plannedSets) {
      throw new BadRequestException('Set index is outside the planned range.');
    }

    const completedSetIndexes = this.normalizeSetIndexes(
      dto.completed
        ? [...progress.completedSetIndexes, dto.setIndex]
        : progress.completedSetIndexes.filter((index) => index !== dto.setIndex),
      progress.plannedSets
    );
    const isExerciseCompleted = completedSetIndexes.length === progress.plannedSets;

    await this.prisma.$transaction(async (tx) => {
      await tx.workoutExerciseProgress.update({
        where: { id: progressId },
        data: {
          completedSetIndexes,
          isExerciseCompleted
        }
      });
      await this.recalculateCounts(tx, session.id);
    });

    this.logger.log(
      `workout set toggled; sessionId=${sessionId}; progressId=${progressId}; setIndex=${dto.setIndex}; completed=${dto.completed}`
    );

    return this.toResponse(await this.getOwnedSession(userId, sessionId));
  }

  async updateExercise(
    userId: string,
    sessionId: string,
    progressId: string,
    dto: UpdateWorkoutExerciseProgressDto
  ) {
    const session = await this.getOwnedSession(userId, sessionId);
    this.assertMutable(session);
    const progress = this.getProgressOrThrow(session, progressId);

    if (progress.plannedSets !== null) {
      throw new BadRequestException('Use set controls for this exercise.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.workoutExerciseProgress.update({
        where: { id: progressId },
        data: {
          isExerciseCompleted: dto.isExerciseCompleted,
          completedSetIndexes: []
        }
      });
      await this.recalculateCounts(tx, session.id);
    });

    this.logger.log(
      `workout exercise updated; sessionId=${sessionId}; progressId=${progressId}; completed=${dto.isExerciseCompleted}`
    );

    return this.toResponse(await this.getOwnedSession(userId, sessionId));
  }

  async complete(userId: string, sessionId: string, dto: CompleteWorkoutSessionDto) {
    const session = await this.getOwnedSession(userId, sessionId);

    if (session.status === WorkoutSessionStatus.COMPLETED) {
      return this.toResponse(session);
    }

    const incomplete =
      session.completedExerciseCount < session.plannedExerciseCount ||
      session.completedSetCount < session.plannedSetCount;

    if (incomplete && !dto.confirmPartialCompletion) {
      throw new BadRequestException('Confirm partial completion to finish this workout.');
    }

    const completed = await this.prisma.workoutSession.update({
      where: { id: session.id },
      data: {
        status: WorkoutSessionStatus.COMPLETED,
        completedAt: new Date()
      },
      include: { exerciseProgress: true, dailyPlan: true }
    });

    this.logger.log(
      `workout session completed; sessionId=${sessionId}; dailyPlanId=${session.dailyPlanId}; completedExercises=${completed.completedExerciseCount}; completedSets=${completed.completedSetCount}`
    );

    return this.toResponse(completed);
  }

  private async getOwnedDailyPlan(userId: string, dailyPlanId: string) {
    const plan = await this.prisma.dailyPlan.findFirst({
      where: { id: dailyPlanId, userId }
    });

    if (!plan) {
      throw new NotFoundException('Daily plan not found.');
    }

    return plan;
  }

  private findByPlan(userId: string, dailyPlanId: string) {
    return this.prisma.workoutSession.findUnique({
      where: {
        userId_dailyPlanId: {
          userId,
          dailyPlanId
        }
      },
      include: { exerciseProgress: true, dailyPlan: true }
    });
  }

  private async getOwnedSession(userId: string, sessionId: string) {
    const session = await this.prisma.workoutSession.findFirst({
      where: { id: sessionId, userId },
      include: { exerciseProgress: true, dailyPlan: true }
    });

    if (!session) {
      throw new NotFoundException('Workout session not found.');
    }

    return session;
  }

  private snapshotPlannedExercises(plan: {
    id: string;
    planLocalDate: string;
    planTimezone: string;
    readinessLevel: string;
    planJson: Prisma.JsonValue;
  }): PlannedWorkoutExercise[] {
    const planJson = normalizeDailyPlanJson({
      planJson: plan.planJson,
      planLocalDate: plan.planLocalDate,
      planTimezone: plan.planTimezone,
      readinessLevel: plan.readinessLevel
    });
    const exercises = Array.isArray(planJson.training.exercises)
      ? planJson.training.exercises
      : [];

    if (planJson.training.intensity === 'REST') {
      return [];
    }

    return exercises
      .filter((exercise) => exercise.name.trim().length > 0)
      .map((exercise, index) => this.toPlannedExercise(plan.id, exercise, index));
  }

  private toPlannedExercise(
    dailyPlanId: string,
    exercise: PlanExerciseForExecution,
    index: number
  ): PlannedWorkoutExercise {
    const plannedSets = this.parseFirstPositiveInteger(exercise.sets);

    return {
      planExerciseKey: this.getPlanExerciseKey(dailyPlanId, exercise, index),
      planExerciseOrder: index,
      exerciseId: exercise.exerciseId ?? null,
      exerciseSlug: exercise.slug ?? null,
      exerciseNameSnapshot: exercise.name,
      plannedSets,
      plannedReps: exercise.reps ?? null,
      plannedDurationSeconds: this.parseDurationSeconds(exercise.duration),
      plannedRestSeconds: this.parseDurationSeconds(exercise.rest)
    };
  }

  private getPlanExerciseKey(
    dailyPlanId: string,
    exercise: PlanExerciseForExecution,
    index: number
  ) {
    const stableIdentity = exercise.exerciseId ?? exercise.slug ?? exercise.name;
    return `${dailyPlanId}:${index}:${this.slugify(stableIdentity)}`;
  }

  private assertMutable(session: WorkoutSessionWithProgress) {
    if (session.status === WorkoutSessionStatus.COMPLETED) {
      throw new BadRequestException('This workout is already completed.');
    }
  }

  private getProgressOrThrow(session: WorkoutSessionWithProgress, progressId: string) {
    const progress = session.exerciseProgress.find((item) => item.id === progressId);

    if (!progress) {
      throw new NotFoundException('Workout exercise progress not found.');
    }

    return progress;
  }

  private async recalculateCounts(
    tx: Prisma.TransactionClient,
    sessionId: string
  ) {
    const progress = await tx.workoutExerciseProgress.findMany({
      where: { workoutSessionId: sessionId }
    });
    const counts = this.calculateCounts(progress);

    await tx.workoutSession.update({
      where: { id: sessionId },
      data: counts
    });
  }

  private calculateCounts(progress: Array<{
    plannedSets: number | null;
    completedSetIndexes: number[];
    isExerciseCompleted: boolean;
  }>) {
    return {
      plannedExerciseCount: progress.length,
      completedExerciseCount: progress.filter((item) => item.isExerciseCompleted).length,
      plannedSetCount: progress.reduce(
        (sum, item) => sum + (item.plannedSets ?? 1),
        0
      ),
      completedSetCount: progress.reduce(
        (sum, item) =>
          sum + (item.plannedSets === null
            ? item.isExerciseCompleted ? 1 : 0
            : item.completedSetIndexes.length),
        0
      )
    };
  }

  private getPlannedUnitCount(exercise: PlannedWorkoutExercise) {
    return exercise.plannedSets ?? 1;
  }

  private normalizeSetIndexes(indexes: number[], plannedSets: number) {
    return [...new Set(indexes)]
      .filter((index) => Number.isInteger(index) && index >= 0 && index < plannedSets)
      .sort((a, b) => a - b);
  }

  private parseFirstPositiveInteger(value?: string) {
    if (!value) return null;
    const match = value.match(/\d+/);
    if (!match) return null;
    const parsed = Number(match[0]);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  private parseDurationSeconds(value?: string) {
    if (!value) return null;
    const match = value.match(/(\d+)\s*(sec|second|seconds|min|minute|minutes|s|m)?/i);
    if (!match) return null;
    const amount = Number(match[1]);
    if (!Number.isInteger(amount) || amount <= 0) return null;
    const unit = match[2]?.toLowerCase();
    return unit?.startsWith('m') ? amount * 60 : amount;
  }

  private slugify(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'exercise';
  }

  private isUniqueConstraintError(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private toResponse(session: WorkoutSessionWithProgress) {
    const sortedProgress = [...session.exerciseProgress].sort(
      (a, b) => a.planExerciseOrder - b.planExerciseOrder
    );
    const progressPercent = session.plannedSetCount > 0
      ? Math.round((session.completedSetCount / session.plannedSetCount) * 100)
      : 0;

    return {
      id: session.id,
      dailyPlanId: session.dailyPlanId,
      status: session.status,
      summary: this.toSummary(session),
      startedAt: session.startedAt.toISOString(),
      completedAt: session.completedAt?.toISOString() ?? null,
      plannedExerciseCount: session.plannedExerciseCount,
      completedExerciseCount: session.completedExerciseCount,
      plannedSetCount: session.plannedSetCount,
      completedSetCount: session.completedSetCount,
      progressPercent,
      exerciseProgress: sortedProgress.map((progress) => ({
        id: progress.id,
        workoutSessionId: progress.workoutSessionId,
        planExerciseKey: progress.planExerciseKey,
        planExerciseOrder: progress.planExerciseOrder,
        exerciseId: progress.exerciseId,
        exerciseSlug: progress.exerciseSlug,
        exerciseNameSnapshot: progress.exerciseNameSnapshot,
        plannedSets: progress.plannedSets,
        plannedReps: progress.plannedReps,
        plannedDurationSeconds: progress.plannedDurationSeconds,
        plannedRestSeconds: progress.plannedRestSeconds,
        completedSetIndexes: progress.completedSetIndexes,
        isExerciseCompleted: progress.isExerciseCompleted,
        createdAt: progress.createdAt.toISOString(),
        updatedAt: progress.updatedAt.toISOString()
      })),
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString()
    };
  }

  private toSummary(session: WorkoutSessionWithProgress) {
    const planJson = normalizeDailyPlanJson({
      planJson: session.dailyPlan.planJson,
      planLocalDate: session.dailyPlan.planLocalDate,
      planTimezone: session.dailyPlan.planTimezone,
      readinessLevel: session.dailyPlan.readinessLevel
    });
    const primaryMuscleGroups = this.derivePrimaryMuscleGroups(planJson);
    const isPartial =
      session.status === WorkoutSessionStatus.COMPLETED &&
      (session.completedExerciseCount < session.plannedExerciseCount ||
        session.completedSetCount < session.plannedSetCount);

    return {
      id: session.id,
      dailyPlanId: session.dailyPlanId,
      status: session.status,
      localDate: session.dailyPlan.planLocalDate,
      startedAt: session.startedAt.toISOString(),
      completedAt: session.completedAt?.toISOString() ?? null,
      plannedExerciseCount: session.plannedExerciseCount,
      completedExerciseCount: session.completedExerciseCount,
      plannedSetCount: session.plannedSetCount,
      completedSetCount: session.completedSetCount,
      isPartial,
      title: primaryMuscleGroups.length
        ? primaryMuscleGroups.slice(0, 3).join(' + ')
        : 'Workout',
      subtitle: isPartial ? 'Partial workout saved' : null,
      primaryMuscleGroups,
      environment: planJson.trainingScheduleSnapshot?.environment ?? null,
      durationMinutes: planJson.trainingScheduleSnapshot?.durationMinutes ?? null
    };
  }

  private derivePrimaryMuscleGroups(planJson: ReturnType<typeof normalizeDailyPlanJson>) {
    const scheduledMuscles = planJson.trainingScheduleSnapshot?.targetMuscles ?? [];
    if (scheduledMuscles.length) {
      return this.uniqueSummaryValues(scheduledMuscles.map((item) => String(item)));
    }

    const exerciseMuscles = (planJson.training.exercises ?? [])
      .flatMap((exercise) => exercise.targetMuscles ?? [])
      .map((item) => this.toReadableSummaryValue(String(item)));

    return this.uniqueSummaryValues(exerciseMuscles).slice(0, 4);
  }

  private uniqueSummaryValues(values: string[]) {
    const seen = new Set<string>();
    const unique: string[] = [];

    for (const value of values) {
      const trimmed = value.trim();
      if (!trimmed || seen.has(trimmed.toLowerCase())) continue;
      seen.add(trimmed.toLowerCase());
      unique.push(trimmed);
    }

    return unique;
  }

  private toReadableSummaryValue(value: string) {
    return value
      .replace(/_/g, ' ')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}
