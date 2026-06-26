import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ExerciseEquipment,
  TrainingScheduleDay,
  TrainingScheduleDayOfWeek,
  TrainingScheduleOverrideMode
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { SafetyService } from '../safety/safety.service';
import { CreateTrainingScheduleItemDto } from './dto/create-training-schedule-item.dto';
import { UpdateTrainingIntentDto } from './dto/update-training-intent.dto';
import { UpdateTrainingScheduleItemDto } from './dto/update-training-schedule-item.dto';
import { UpsertWeeklyTrainingScheduleDto, WeeklyTrainingScheduleDayDto } from './dto/upsert-weekly-training-schedule.dto';
import { TrainingScheduleResolverService } from './training-schedule-resolver.service';

@Injectable()
export class TrainingScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly safetyService: SafetyService,
    private readonly resolver: TrainingScheduleResolverService
  ) {}

  async getWeeklySchedule(userId: string) {
    const [user, schedule] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
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
      }),
      this.prisma.trainingSchedule.findUnique({
        where: { userId },
        include: { days: { orderBy: { dayOfWeek: 'asc' } } }
      })
    ]);
    const defaults = this.resolver.resolveDefaults({
      trainingPreference: user.trainingPreference,
      legacyScheduleItems: user.schedules,
      noTrainingPlanned: user.noTrainingPlanned
    });
    const days = this.resolver.getOrderedDays().map((dayOfWeek) => {
      const day = schedule?.days.find((item) => item.dayOfWeek === dayOfWeek);
      const draft = day ?? this.createDefaultDay(dayOfWeek);
      return {
        ...this.toDayResponse(draft),
        resolved: this.resolver.resolveDay({
          day: draft as TrainingScheduleDay,
          defaults,
          source: schedule?.isActive ? 'WEEKLY_SCHEDULE' : 'GLOBAL_DEFAULTS',
          localDate: '',
          dayOfWeek
        })
      };
    });

    return {
      id: schedule?.id ?? null,
      isActive: schedule?.isActive ?? false,
      weekStartsOn: 'MONDAY' as const,
      derivedWeeklyFrequency: schedule?.isActive
        ? days.filter((day) => day.isTrainingDay).length
        : user.schedules.length,
      days,
      defaults: {
        targetMuscles: defaults.targetMuscles,
        environment: defaults.environment,
        availableEquipment: defaults.availableEquipment,
        durationMinutes: defaults.durationMinutes,
        protocolPreference: defaults.protocolPreference
      }
    };
  }

  async upsertWeeklySchedule(userId: string, dto: UpsertWeeklyTrainingScheduleDto) {
    this.validateWeeklySchedule(dto);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.trainingSchedule.findUnique({
        where: { userId },
        select: { id: true }
      });
      const schedule = existing
        ? await tx.trainingSchedule.update({
            where: { id: existing.id },
            data: { isActive: dto.isActive }
          })
        : await tx.trainingSchedule.create({
            data: {
              userId,
              isActive: dto.isActive,
              weekStartsOn: TrainingScheduleDayOfWeek.MONDAY
            }
          });

      await tx.trainingScheduleDay.deleteMany({ where: { trainingScheduleId: schedule.id } });
      await tx.trainingScheduleDay.createMany({
        data: this.resolver.getOrderedDays().map((dayOfWeek) => {
          const day = dto.days.find((item) => item.dayOfWeek === dayOfWeek)!;
          return {
            trainingScheduleId: schedule.id,
            dayOfWeek,
            isTrainingDay: day.isTrainingDay,
            targetMusclesMode: day.targetMusclesMode,
            targetMuscles: this.unique(day.targetMuscles ?? []),
            environmentMode: day.environmentMode,
            environment: day.environmentMode === TrainingScheduleOverrideMode.CUSTOM ? day.environment ?? null : null,
            equipmentMode: day.equipmentMode,
            availableEquipment: this.unique(day.availableEquipment ?? []),
            durationMode: day.durationMode,
            durationMinutes: day.durationMode === TrainingScheduleOverrideMode.CUSTOM ? day.durationMinutes ?? null : null,
            protocolMode: day.protocolMode ?? TrainingScheduleOverrideMode.USE_DEFAULT,
            protocolPreference: day.protocolMode === TrainingScheduleOverrideMode.CUSTOM ? day.protocolPreference ?? null : null
          };
        })
      });
    });
    // Return a fresh resolved view after the transaction commits.
  }

  async saveWeeklySchedule(userId: string, dto: UpsertWeeklyTrainingScheduleDto) {
    await this.upsertWeeklySchedule(userId, dto);
    return this.getWeeklySchedule(userId);
  }

  async deactivateWeeklySchedule(userId: string) {
    await this.prisma.trainingSchedule.updateMany({
      where: { userId },
      data: { isActive: false }
    });
    return this.getWeeklySchedule(userId);
  }

  listItems(userId: string) {
    return this.prisma.trainingScheduleItem.findMany({
      where: { userId },
      orderBy: [{ dayOfWeek: 'asc' }, { localTime: 'asc' }]
    });
  }

  createItem(userId: string, dto: CreateTrainingScheduleItemDto) {
    this.safetyService.validateTrainingScheduleItem(dto);

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { noTrainingPlanned: false },
        select: { id: true }
      });

      return tx.trainingScheduleItem.create({
        data: {
          userId,
          dayOfWeek: dto.dayOfWeek,
          localTime: dto.localTime,
          sportType: dto.sportType,
          durationMinutes: dto.durationMinutes,
          intensity: dto.intensity,
          description: dto.description
        }
      });
    });
  }

  async updateIntent(userId: string, dto: UpdateTrainingIntentDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { noTrainingPlanned: dto.noTrainingPlanned },
      select: { noTrainingPlanned: true }
    });

    return user;
  }

  async updateItem(userId: string, itemId: string, dto: UpdateTrainingScheduleItemDto) {
    const existingItem = await this.ensureItemBelongsToUser(userId, itemId);
    this.safetyService.validateTrainingScheduleItem({
      durationMinutes: dto.durationMinutes ?? existingItem.durationMinutes,
      intensity: dto.intensity ?? existingItem.intensity,
      description: dto.description ?? existingItem.description
    });

    return this.prisma.trainingScheduleItem.update({
      where: { id: itemId },
      data: dto
    });
  }

  async deleteItem(userId: string, itemId: string) {
    await this.ensureItemBelongsToUser(userId, itemId);
    await this.prisma.trainingScheduleItem.delete({ where: { id: itemId } });

    return { deleted: true };
  }

  private async ensureItemBelongsToUser(userId: string, itemId: string) {
    const item = await this.prisma.trainingScheduleItem.findFirst({
      where: {
        id: itemId,
        userId
      }
    });

    if (!item) {
      throw new NotFoundException('Training schedule item not found.');
    }

    return item;
  }

  private validateWeeklySchedule(dto: UpsertWeeklyTrainingScheduleDto) {
    const orderedDays = this.resolver.getOrderedDays();
    const seen = new Set(dto.days.map((day) => day.dayOfWeek));
    if (seen.size !== 7 || orderedDays.some((day) => !seen.has(day))) {
      throw new BadRequestException('Weekly schedule must include exactly one entry for each weekday.');
    }

    for (const day of dto.days) {
      this.assertNoDuplicates(day.targetMuscles ?? [], `${day.dayOfWeek} target muscles`);
      this.assertNoDuplicates(day.availableEquipment ?? [], `${day.dayOfWeek} equipment`);

      if (
        day.isTrainingDay &&
        day.targetMusclesMode === TrainingScheduleOverrideMode.CUSTOM &&
        (day.targetMuscles ?? []).length === 0
      ) {
        throw new BadRequestException('Custom muscle focus requires at least one muscle on training days.');
      }

      if (day.environmentMode === TrainingScheduleOverrideMode.CUSTOM && !day.environment) {
        throw new BadRequestException('Custom location requires a location value.');
      }

      if (day.durationMode === TrainingScheduleOverrideMode.CUSTOM && !day.durationMinutes) {
        throw new BadRequestException('Custom duration requires durationMinutes.');
      }
    }
  }

  private createDefaultDay(dayOfWeek: TrainingScheduleDayOfWeek) {
    return {
      id: '',
      dayOfWeek,
      isTrainingDay: false,
      targetMusclesMode: TrainingScheduleOverrideMode.USE_DEFAULT,
      targetMuscles: [],
      environmentMode: TrainingScheduleOverrideMode.USE_DEFAULT,
      environment: null,
      equipmentMode: TrainingScheduleOverrideMode.USE_DEFAULT,
      availableEquipment: [] as ExerciseEquipment[],
      durationMode: TrainingScheduleOverrideMode.USE_DEFAULT,
      durationMinutes: null,
      protocolMode: TrainingScheduleOverrideMode.USE_DEFAULT,
      protocolPreference: null
    };
  }

  private toDayResponse(day: TrainingScheduleDay | ReturnType<TrainingScheduleService['createDefaultDay']>) {
    return {
      id: day.id,
      dayOfWeek: day.dayOfWeek,
      isTrainingDay: day.isTrainingDay,
      targetMusclesMode: day.targetMusclesMode,
      targetMuscles: day.targetMuscles,
      environmentMode: day.environmentMode,
      environment: day.environment,
      equipmentMode: day.equipmentMode,
      availableEquipment: day.availableEquipment,
      durationMode: day.durationMode,
      durationMinutes: day.durationMinutes,
      protocolMode: day.protocolMode,
      protocolPreference: day.protocolPreference
    };
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
