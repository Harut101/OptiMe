import { BadRequestException, Injectable } from '@nestjs/common';
import {
  DailyTrainingOverride,
  DailyTrainingOverrideSource,
  DailyTrainingOverrideType
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { TrainingScheduleResolverService } from '../training-schedule/training-schedule-resolver.service';
import { MoveWorkoutDto } from './dto/move-workout.dto';
import { UpsertDailyTrainingOverrideDto } from './dto/upsert-daily-training-override.dto';

@Injectable()
export class TrainingOverridesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trainingScheduleResolver: TrainingScheduleResolverService
  ) {}

  async getByDate(userId: string, localDate: string) {
    this.assertLocalDate(localDate);

    const override = await this.prisma.dailyTrainingOverride.findUnique({
      where: { userId_localDate: { userId, localDate } }
    });

    return { override: override ? this.toResponse(override) : null };
  }

  async upsert(userId: string, localDate: string, dto: UpsertDailyTrainingOverrideDto) {
    this.assertLocalDate(localDate);
    this.assertNoDuplicates(dto.targetMuscles ?? [], 'target muscles');
    this.assertNoDuplicates(dto.availableEquipment ?? [], 'equipment');

    const user = await this.getUserPlanningDefaults(userId);
    const timezone = dto.timezone?.trim() || user.timezone;
    const isTrainingDay = dto.overrideType === DailyTrainingOverrideType.TRAINING_DAY;

    const override = await this.prisma.dailyTrainingOverride.upsert({
      where: { userId_localDate: { userId, localDate } },
      create: {
        userId,
        localDate,
        timezone,
        overrideType: dto.overrideType,
        targetMuscles: isTrainingDay ? this.unique(dto.targetMuscles ?? []) : [],
        environment: isTrainingDay ? dto.environment ?? null : null,
        availableEquipment: isTrainingDay ? this.unique(dto.availableEquipment ?? []) : [],
        durationMinutes: isTrainingDay ? dto.durationMinutes ?? null : null,
        protocolPreference: isTrainingDay ? dto.protocolPreference ?? null : null,
        source: dto.source ?? DailyTrainingOverrideSource.MANUAL,
        movedFromLocalDate: dto.movedFromLocalDate ?? null,
        movedToLocalDate: dto.movedToLocalDate ?? null
      },
      update: {
        timezone,
        overrideType: dto.overrideType,
        targetMuscles: isTrainingDay ? this.unique(dto.targetMuscles ?? []) : [],
        environment: isTrainingDay ? dto.environment ?? null : null,
        availableEquipment: isTrainingDay ? this.unique(dto.availableEquipment ?? []) : [],
        durationMinutes: isTrainingDay ? dto.durationMinutes ?? null : null,
        protocolPreference: isTrainingDay ? dto.protocolPreference ?? null : null,
        source: dto.source ?? DailyTrainingOverrideSource.MANUAL,
        movedFromLocalDate: dto.movedFromLocalDate ?? null,
        movedToLocalDate: dto.movedToLocalDate ?? null
      }
    });

    return this.toResponse(override);
  }

  async delete(userId: string, localDate: string) {
    this.assertLocalDate(localDate);
    await this.prisma.dailyTrainingOverride.deleteMany({
      where: { userId, localDate }
    });

    return { deleted: true };
  }

  async moveWorkout(userId: string, dto: MoveWorkoutDto) {
    this.assertLocalDate(dto.fromLocalDate);
    this.assertLocalDate(dto.toLocalDate);

    if (dto.fromLocalDate === dto.toLocalDate) {
      throw new BadRequestException('Move workout dates must be different.');
    }

    const user = await this.getUserPlanningDefaults(userId);
    const timezone = dto.timezone?.trim() || user.timezone;
    const sourceContext = await this.trainingScheduleResolver.resolveForUser({
      userId,
      planLocalDate: dto.fromLocalDate,
      trainingPreference: user.trainingPreference,
      legacyScheduleItems: user.schedules,
      noTrainingPlanned: user.noTrainingPlanned,
      ignoreDailyOverride: true
    });

    if (!sourceContext.isTrainingDay) {
      throw new BadRequestException('Source date is not currently resolved as a training day.');
    }

    const [from, to] = await this.prisma.$transaction([
      this.prisma.dailyTrainingOverride.upsert({
        where: { userId_localDate: { userId, localDate: dto.fromLocalDate } },
        create: {
          userId,
          localDate: dto.fromLocalDate,
          timezone,
          overrideType: DailyTrainingOverrideType.REST_DAY,
          source: DailyTrainingOverrideSource.USER_MOVED_WORKOUT,
          movedToLocalDate: dto.toLocalDate
        },
        update: {
          timezone,
          overrideType: DailyTrainingOverrideType.REST_DAY,
          targetMuscles: [],
          environment: null,
          availableEquipment: [],
          durationMinutes: null,
          protocolPreference: null,
          source: DailyTrainingOverrideSource.USER_MOVED_WORKOUT,
          movedFromLocalDate: null,
          movedToLocalDate: dto.toLocalDate
        }
      }),
      this.prisma.dailyTrainingOverride.upsert({
        where: { userId_localDate: { userId, localDate: dto.toLocalDate } },
        create: {
          userId,
          localDate: dto.toLocalDate,
          timezone,
          overrideType: DailyTrainingOverrideType.TRAINING_DAY,
          targetMuscles: sourceContext.targetMuscles,
          environment: sourceContext.environment,
          availableEquipment: sourceContext.availableEquipment,
          durationMinutes: sourceContext.durationMinutes,
          protocolPreference: sourceContext.protocolPreference,
          source: DailyTrainingOverrideSource.USER_MOVED_WORKOUT,
          movedFromLocalDate: dto.fromLocalDate
        },
        update: {
          timezone,
          overrideType: DailyTrainingOverrideType.TRAINING_DAY,
          targetMuscles: sourceContext.targetMuscles,
          environment: sourceContext.environment,
          availableEquipment: sourceContext.availableEquipment,
          durationMinutes: sourceContext.durationMinutes,
          protocolPreference: sourceContext.protocolPreference,
          source: DailyTrainingOverrideSource.USER_MOVED_WORKOUT,
          movedFromLocalDate: dto.fromLocalDate,
          movedToLocalDate: null
        }
      })
    ]);

    return {
      from: this.toResponse(from),
      to: this.toResponse(to)
    };
  }

  private getUserPlanningDefaults(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        timezone: true,
        noTrainingPlanned: true,
        schedules: { select: { dayOfWeek: true, durationMinutes: true } },
        trainingPreference: {
          select: {
            targetMuscleGroups: true,
            equipment: true,
            trainingLevel: true,
            limitationsOrPainAreas: true
          }
        }
      }
    });
  }

  private toResponse(override: DailyTrainingOverride) {
    return {
      id: override.id,
      userId: override.userId,
      localDate: override.localDate,
      timezone: override.timezone,
      overrideType: override.overrideType,
      targetMuscles: override.targetMuscles,
      environment: override.environment,
      availableEquipment: override.availableEquipment,
      durationMinutes: override.durationMinutes,
      protocolPreference: override.protocolPreference,
      source: override.source,
      movedFromLocalDate: override.movedFromLocalDate,
      movedToLocalDate: override.movedToLocalDate,
      createdAt: override.createdAt.toISOString(),
      updatedAt: override.updatedAt.toISOString()
    };
  }

  private assertLocalDate(localDate: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
      throw new BadRequestException('localDate must use YYYY-MM-DD format.');
    }

    const parsed = new Date(`${localDate}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== localDate) {
      throw new BadRequestException('localDate must be a valid calendar date.');
    }
  }

  private unique<T>(items: T[]) {
    return [...new Set(items)];
  }

  private assertNoDuplicates(items: unknown[], label: string) {
    if (new Set(items).size !== items.length) {
      throw new BadRequestException(`Duplicate values are not allowed for ${label}.`);
    }
  }
}
