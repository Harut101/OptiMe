import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DailyCheckInType, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateDailyPlanCheckInDto } from './dto/create-daily-plan-check-in.dto';

const mealStatuses = ['COMPLETED', 'PARTIALLY_COMPLETED', 'SKIPPED', 'SWAPPED'] as const;
const trainingStatuses = ['COMPLETED', 'PARTIALLY_COMPLETED', 'SKIPPED', 'RESTED_INSTEAD'] as const;
const maxNoteLength = 500;

type CheckInPayload = Record<string, unknown>;

@Injectable()
export class DailyPlanCheckInsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForPlan(userId: string, dailyPlanId: string) {
    await this.ensurePlanBelongsToUser(userId, dailyPlanId);

    const checkIns = await this.prisma.dailyPlanCheckIn.findMany({
      where: { userId, dailyPlanId },
      orderBy: { updatedAt: 'desc' }
    });

    return {
      items: checkIns.map((checkIn) => this.toResponse(checkIn))
    };
  }

  async upsertForPlan(userId: string, dailyPlanId: string, dto: CreateDailyPlanCheckInDto) {
    await this.ensurePlanBelongsToUser(userId, dailyPlanId);

    const normalizedPayload = this.validatePayload(dto.type, dto.payload);
    const subjectKey = this.getSubjectKey(dto.type, normalizedPayload);

    const checkIn = await this.prisma.dailyPlanCheckIn.upsert({
      where: {
        userId_dailyPlanId_type_subjectKey: {
          userId,
          dailyPlanId,
          type: dto.type,
          subjectKey
        }
      },
      update: {
        payload: normalizedPayload as Prisma.InputJsonValue
      },
      create: {
        userId,
        dailyPlanId,
        type: dto.type,
        subjectKey,
        payload: normalizedPayload as Prisma.InputJsonValue
      }
    });

    return this.toResponse(checkIn);
  }

  async getRecentSummary(userId: string) {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 14);

    const checkIns = await this.prisma.dailyPlanCheckIn.findMany({
      where: {
        userId,
        createdAt: {
          gte: since
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    const mealCheckIns = checkIns.filter((checkIn) => checkIn.type === DailyCheckInType.MEAL);
    const trainingCheckIns = checkIns.filter(
      (checkIn) => checkIn.type === DailyCheckInType.TRAINING
    );
    const eveningCheckIns = checkIns.filter(
      (checkIn) => checkIn.type === DailyCheckInType.EVENING_REFLECTION
    );
    const tirednessValues = eveningCheckIns
      .map((checkIn) => this.asRecord(checkIn.payload).tirednessLevel)
      .filter((value): value is number => typeof value === 'number');
    const painOrDiscomfortReported = trainingCheckIns.some(
      (checkIn) => this.asRecord(checkIn.payload).painOrDiscomfort === true
    );
    const highTirednessReported = tirednessValues.some((value) => value >= 8);
    const illnessLikeNotesReported = checkIns.some((checkIn) =>
      this.hasIllnessLikeNote(this.asRecord(checkIn.payload).notes)
    );

    return {
      recentCheckInCount: checkIns.length,
      recentSkippedMealsCount: mealCheckIns.filter(
        (checkIn) => this.asRecord(checkIn.payload).status === 'SKIPPED'
      ).length,
      recentCompletedWorkoutsCount: trainingCheckIns.filter(
        (checkIn) => this.asRecord(checkIn.payload).status === 'COMPLETED'
      ).length,
      recentAverageTiredness:
        tirednessValues.length > 0
          ? Number(
              (
                tirednessValues.reduce((sum, value) => sum + value, 0) / tirednessValues.length
              ).toFixed(1)
            )
          : null,
      painOrDiscomfortReported,
      highTirednessReported,
      illnessLikeNotesReported,
      conservativeTrainingRecommended:
        painOrDiscomfortReported || highTirednessReported || illnessLikeNotesReported
    };
  }

  private async ensurePlanBelongsToUser(userId: string, dailyPlanId: string) {
    const plan = await this.prisma.dailyPlan.findFirst({
      where: {
        id: dailyPlanId,
        userId
      },
      select: { id: true }
    });

    if (!plan) {
      throw new NotFoundException('Daily plan not found.');
    }
  }

  private validatePayload(type: DailyCheckInType, payload: CheckInPayload) {
    switch (type) {
      case DailyCheckInType.MEAL:
        return this.validateMealPayload(payload);
      case DailyCheckInType.TRAINING:
        return this.validateTrainingPayload(payload);
      case DailyCheckInType.EVENING_REFLECTION:
        return this.validateEveningPayload(payload);
      default:
        throw new BadRequestException('Unsupported check-in type.');
    }
  }

  private validateMealPayload(payload: CheckInPayload) {
    const status = this.requireEnum(payload.status, mealStatuses, 'meal status');
    const mealIndex = this.optionalInteger(payload.mealIndex, 0, 20, 'meal index');
    const mealName = this.optionalString(payload.mealName, 80, 'meal name');

    if (mealIndex === undefined && !mealName) {
      throw new BadRequestException('Meal check-in needs a meal name or meal index.');
    }

    return this.compact({
      mealIndex,
      mealName,
      status,
      notes: this.optionalString(payload.notes, maxNoteLength, 'notes')
    });
  }

  private validateTrainingPayload(payload: CheckInPayload) {
    return this.compact({
      status: this.requireEnum(payload.status, trainingStatuses, 'training status'),
      perceivedDifficulty: this.optionalInteger(
        payload.perceivedDifficulty,
        1,
        10,
        'perceived difficulty'
      ),
      energyAfter: this.optionalInteger(payload.energyAfter, 1, 10, 'energy after'),
      painOrDiscomfort:
        typeof payload.painOrDiscomfort === 'boolean' ? payload.painOrDiscomfort : undefined,
      notes: this.optionalString(payload.notes, maxNoteLength, 'notes')
    });
  }

  private validateEveningPayload(payload: CheckInPayload) {
    const normalized = this.compact({
      energyLevel: this.optionalInteger(payload.energyLevel, 1, 10, 'energy level'),
      tirednessLevel: this.optionalInteger(payload.tirednessLevel, 1, 10, 'tiredness level'),
      sorenessLevel: this.optionalInteger(payload.sorenessLevel, 1, 10, 'soreness level'),
      mood: this.optionalString(payload.mood, 80, 'mood'),
      notes: this.optionalString(payload.notes, maxNoteLength, 'notes')
    });

    if (Object.keys(normalized).length === 0) {
      throw new BadRequestException('Add at least one reflection detail or skip this for now.');
    }

    return normalized;
  }

  private getSubjectKey(type: DailyCheckInType, payload: CheckInPayload) {
    if (type === DailyCheckInType.MEAL) {
      if (typeof payload.mealIndex === 'number') {
        return `meal:${payload.mealIndex}`;
      }

      return `meal:${String(payload.mealName).trim().toLowerCase()}`;
    }

    if (type === DailyCheckInType.TRAINING) {
      return 'training';
    }

    return 'evening';
  }

  private requireEnum<T extends readonly string[]>(value: unknown, values: T, label: string) {
    if (typeof value !== 'string' || !values.includes(value)) {
      throw new BadRequestException(`Please choose a valid ${label}.`);
    }

    return value;
  }

  private optionalInteger(value: unknown, min: number, max: number, label: string) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const parsedValue = Number(value);

    if (!Number.isInteger(parsedValue) || parsedValue < min || parsedValue > max) {
      throw new BadRequestException(`Please enter ${label} from ${min} to ${max}.`);
    }

    return parsedValue;
  }

  private optionalString(value: unknown, maxLength: number, label: string) {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException(`Please enter valid ${label}.`);
    }

    const trimmed = value.trim();

    if (!trimmed) {
      return undefined;
    }

    if (trimmed.length > maxLength) {
      throw new BadRequestException(`${label} is too long.`);
    }

    return trimmed;
  }

  private hasIllnessLikeNote(value: unknown) {
    if (typeof value !== 'string') {
      return false;
    }

    return /\b(pain|dizz(?:y|iness)|ill|sick|fever|exhausted|injur(?:y|ed)|nausea)\b/i.test(value);
  }

  private asRecord(value: unknown) {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private compact<T extends Record<string, unknown>>(value: T) {
    return Object.fromEntries(
      Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
    ) as T;
  }

  private toResponse(checkIn: {
    id: string;
    dailyPlanId: string;
    type: DailyCheckInType;
    subjectKey: string;
    payload: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: checkIn.id,
      dailyPlanId: checkIn.dailyPlanId,
      type: checkIn.type,
      subjectKey: checkIn.subjectKey,
      payload: checkIn.payload,
      createdAt: checkIn.createdAt.toISOString(),
      updatedAt: checkIn.updatedAt.toISOString()
    };
  }
}
