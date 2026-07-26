import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  DailyCheckInType,
  PostWorkoutFeeling,
  PreWorkoutReadinessStatus,
  Prisma,
  WorkoutSessionStatus
} from '@prisma/client';
import type {
  DailyPlanCheckpointEvaluationResponse,
  PlanCheckpointFacts,
  PlanCheckpointWorkoutStatus
} from '@optime/shared-types';

import { PrismaService } from '../../prisma/prisma.service';
import { normalizeDailyPlanJson } from '../daily-plans/daily-plan-normalizer';
import { selectPreferredWearableSnapshot } from '../health/wearable-source-priority';
import { EvaluateDailyPlanCheckpointDto } from './dto/evaluate-daily-plan-checkpoint.dto';
import { PlanCheckpointMaterialChangeDetectorService } from './plan-checkpoint-material-change-detector.service';

type PlanWithCheckpointFacts = Prisma.DailyPlanGetPayload<{
  include: {
    foodDayLogs: true;
    workoutSessions: true;
    checkIns: true;
  };
}>;

@Injectable()
export class PlanCheckpointService {
  private readonly logger = new Logger(PlanCheckpointService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly materialChangeDetector: PlanCheckpointMaterialChangeDetectorService
  ) {}

  async captureGenerationBaseline(
    userId: string,
    planLocalDate: string,
    dailyPlanId?: string
  ): Promise<PlanCheckpointFacts> {
    const plan = dailyPlanId
      ? await this.getOwnedPlanWithFacts(userId, dailyPlanId)
      : null;

    if (plan && plan.planLocalDate !== planLocalDate) {
      throw new NotFoundException('Daily plan not found.');
    }

    return this.captureFacts(userId, planLocalDate, plan);
  }

  async evaluate(
    userId: string,
    dailyPlanId: string,
    dto: EvaluateDailyPlanCheckpointDto
  ): Promise<DailyPlanCheckpointEvaluationResponse> {
    const plan = await this.getOwnedPlanWithFacts(userId, dailyPlanId);
    const current = await this.captureFacts(userId, plan.planLocalDate, plan);
    const normalizedPlan = normalizeDailyPlanJson({
      planJson: plan.planJson,
      planLocalDate: plan.planLocalDate,
      planTimezone: plan.planTimezone,
      readinessLevel: plan.readinessLevel
    });
    const baseline = normalizedPlan.checkpointBaseline;

    if (!baseline) {
      await this.prisma.dailyPlan.update({
        where: { id: plan.id },
        data: {
          planJson: {
            ...normalizedPlan,
            checkpointBaseline: current
          } as unknown as Prisma.JsonObject
        }
      });

      const evaluation = this.materialChangeDetector.evaluate({
        trigger: dto.trigger,
        planLocalDate: plan.planLocalDate,
        baseline: current,
        current
      });
      this.logger.log(
        `plan checkpoint baseline initialized; dailyPlanId=${plan.id}; trigger=${dto.trigger}`
      );

      return {
        dailyPlanId: plan.id,
        planLocalDate: plan.planLocalDate,
        baselineInitialized: true,
        evaluatedAt: current.capturedAt,
        ...evaluation
      };
    }

    const evaluation = this.materialChangeDetector.evaluate({
      trigger: dto.trigger,
      planLocalDate: plan.planLocalDate,
      baseline,
      current
    });
    this.logger.log(
      [
        'plan checkpoint evaluated',
        `dailyPlanId=${plan.id}`,
        `trigger=${dto.trigger}`,
        `materialChange=${evaluation.materialChangeDetected}`,
        `severity=${evaluation.severity}`,
        `reasonCount=${evaluation.reasonCodes.length}`
      ].join('; ')
    );

    return {
      dailyPlanId: plan.id,
      planLocalDate: plan.planLocalDate,
      baselineInitialized: false,
      evaluatedAt: current.capturedAt,
      ...evaluation
    };
  }

  private async captureFacts(
    userId: string,
    planLocalDate: string,
    plan: PlanWithCheckpointFacts | null
  ): Promise<PlanCheckpointFacts> {
    const snapshots = await this.prisma.wearableDailySnapshot.findMany({
      where: { userId, localDate: planLocalDate }
    });
    const snapshot = selectPreferredWearableSnapshot(snapshots);
    const foodLog = plan?.foodDayLogs[0];
    const workoutSession = plan?.workoutSessions[0];
    const mealCheckIns =
      plan?.checkIns.filter((checkIn) => checkIn.type === DailyCheckInType.MEAL) ?? [];
    const trainingCheckIn = plan?.checkIns.find(
      (checkIn) => checkIn.type === DailyCheckInType.TRAINING
    );
    const eveningCheckIn = plan?.checkIns.find(
      (checkIn) => checkIn.type === DailyCheckInType.EVENING_REFLECTION
    );
    const trainingPayload = this.asRecord(trainingCheckIn?.payload);
    const eveningPayload = this.asRecord(eveningCheckIn?.payload);

    return {
      capturedAt: new Date().toISOString(),
      health: {
        source: snapshot?.source ?? null,
        localDate: snapshot?.localDate ?? null,
        sleepMinutes: snapshot?.sleepMinutes ?? null,
        steps: snapshot?.steps ?? null,
        activeCaloriesKcal: snapshot?.activeCaloriesKcal ?? null,
        workoutMinutes: snapshot?.workoutMinutes ?? null
      },
      progress: {
        completedMeals:
          foodLog?.completedMealCount ??
          mealCheckIns.filter(
            (checkIn) => this.asRecord(checkIn.payload).status === 'COMPLETED'
          ).length,
        skippedMeals:
          foodLog?.skippedMealCount ??
          mealCheckIns.filter(
            (checkIn) => this.asRecord(checkIn.payload).status === 'SKIPPED'
          ).length,
        workoutStatus: this.resolveWorkoutStatus(workoutSession?.status, trainingPayload.status)
      },
      checkIn: {
        energyLevel: this.readLevel(eveningPayload.energyLevel),
        tirednessLevel: this.readLevel(eveningPayload.tirednessLevel),
        sorenessLevel: this.readLevel(eveningPayload.sorenessLevel)
      },
      safetySignals: {
        painOrLimitation:
          trainingPayload.painOrDiscomfort === true ||
          workoutSession?.preWorkoutReadinessStatus ===
            PreWorkoutReadinessStatus.PAIN_OR_LIMITATION ||
          (workoutSession?.preWorkoutPainAreas.length ?? 0) > 0 ||
          workoutSession?.postWorkoutFeeling === PostWorkoutFeeling.PAIN_DURING_WORKOUT ||
          (workoutSession?.postWorkoutPainAreas.length ?? 0) > 0,
        illness: false,
        dizziness: false,
        exhaustion: false
      }
    };
  }

  private resolveWorkoutStatus(
    sessionStatus: WorkoutSessionStatus | undefined,
    checkInStatus: unknown
  ): PlanCheckpointWorkoutStatus {
    if (checkInStatus === 'RESTED_INSTEAD') return 'RESTED_INSTEAD';
    if (checkInStatus === 'SKIPPED') return 'SKIPPED';
    if (
      sessionStatus === WorkoutSessionStatus.COMPLETED ||
      checkInStatus === 'COMPLETED'
    ) {
      return 'COMPLETED';
    }
    if (
      sessionStatus === WorkoutSessionStatus.IN_PROGRESS ||
      checkInStatus === 'PARTIALLY_COMPLETED'
    ) {
      return 'IN_PROGRESS';
    }

    return 'NOT_STARTED';
  }

  private readLevel(value: unknown) {
    return typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= 1 &&
      value <= 10
      ? value
      : null;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private async getOwnedPlanWithFacts(userId: string, dailyPlanId: string) {
    const plan = await this.prisma.dailyPlan.findFirst({
      where: { id: dailyPlanId, userId },
      include: {
        foodDayLogs: true,
        workoutSessions: {
          orderBy: { updatedAt: 'desc' },
          take: 1
        },
        checkIns: {
          orderBy: { updatedAt: 'desc' }
        }
      }
    });

    if (!plan) {
      throw new NotFoundException('Daily plan not found.');
    }

    return plan;
  }
}
