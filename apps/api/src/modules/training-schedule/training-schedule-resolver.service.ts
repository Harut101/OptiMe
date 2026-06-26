import { Injectable, Logger } from '@nestjs/common';
import {
  ExerciseEquipment,
  TargetMuscleGroup,
  TrainingEnvironment,
  TrainingEquipment,
  TrainingLevel,
  TrainingScheduleDay,
  TrainingScheduleDayOfWeek,
  TrainingScheduleOverrideMode,
  TrainingPreference
} from '@prisma/client';
import type { ResolvedTrainingDayContext, TrainingScheduleInheritedField } from '@optime/shared-types';

import { PrismaService } from '../../prisma/prisma.service';

const ORDERED_DAYS: TrainingScheduleDayOfWeek[] = [
  TrainingScheduleDayOfWeek.MONDAY,
  TrainingScheduleDayOfWeek.TUESDAY,
  TrainingScheduleDayOfWeek.WEDNESDAY,
  TrainingScheduleDayOfWeek.THURSDAY,
  TrainingScheduleDayOfWeek.FRIDAY,
  TrainingScheduleDayOfWeek.SATURDAY,
  TrainingScheduleDayOfWeek.SUNDAY
];

type LegacyScheduleItem = { dayOfWeek: number; durationMinutes: number };
type DefaultsInput = {
  trainingPreference: Pick<
    TrainingPreference,
    'targetMuscleGroups' | 'equipment' | 'trainingLevel' | 'limitationsOrPainAreas'
  > | null;
  legacyScheduleItems: LegacyScheduleItem[];
  noTrainingPlanned: boolean;
};

export type TrainingScheduleDefaults = {
  targetMuscles: TargetMuscleGroup[];
  environment: TrainingEnvironment | null;
  availableEquipment: ExerciseEquipment[];
  durationMinutes: number;
  protocolPreference: string | null;
  trainingLevel: TrainingLevel;
};

@Injectable()
export class TrainingScheduleResolverService {
  private readonly logger = new Logger(TrainingScheduleResolverService.name);

  constructor(private readonly prisma: PrismaService) {}

  async resolveForUser(input: DefaultsInput & {
    userId: string;
    planLocalDate: string;
  }): Promise<ResolvedTrainingDayContext> {
    const defaults = this.resolveDefaults(input);
    const dayOfWeek = this.getDayOfWeek(input.planLocalDate);
    const schedule = await this.prisma.trainingSchedule.findUnique({
      where: { userId: input.userId },
      include: { days: true }
    });

    if (!schedule?.isActive) {
      const context: ResolvedTrainingDayContext = {
        source: 'GLOBAL_DEFAULTS',
        localDate: input.planLocalDate,
        dayOfWeek,
        isTrainingDay: !input.noTrainingPlanned,
        targetMuscles: defaults.targetMuscles,
        environment: defaults.environment,
        availableEquipment: defaults.availableEquipment,
        durationMinutes: defaults.durationMinutes,
        protocolPreference: defaults.protocolPreference,
        inheritedFields: ['TARGET_MUSCLES', 'ENVIRONMENT', 'EQUIPMENT', 'DURATION', 'PROTOCOL']
      };
      this.logResolution(context);
      return context;
    }

    const day = schedule.days.find((item) => item.dayOfWeek === dayOfWeek);
    const context = this.resolveDay({
      day,
      defaults,
      source: 'WEEKLY_SCHEDULE',
      localDate: input.planLocalDate,
      dayOfWeek
    });
    this.logResolution(context);
    return context;
  }

  resolveDefaults(input: DefaultsInput): TrainingScheduleDefaults {
    return {
      targetMuscles: input.trainingPreference?.targetMuscleGroups ?? [],
      environment: this.mapEnvironment(input.trainingPreference?.equipment ?? []),
      availableEquipment: this.mapAvailableExerciseEquipment(input.trainingPreference?.equipment ?? []),
      durationMinutes: this.getDefaultDuration(input.legacyScheduleItems, input.noTrainingPlanned),
      protocolPreference: null,
      trainingLevel: input.trainingPreference?.trainingLevel ?? TrainingLevel.BEGINNER
    };
  }

  resolveDay(input: {
    day?: TrainingScheduleDay | null;
    defaults: TrainingScheduleDefaults;
    source: 'WEEKLY_SCHEDULE' | 'GLOBAL_DEFAULTS';
    localDate: string;
    dayOfWeek: TrainingScheduleDayOfWeek;
  }): ResolvedTrainingDayContext {
    const inheritedFields: TrainingScheduleInheritedField[] = [];
    const day = input.day;

    if (!day) {
      return {
        source: input.source,
        localDate: input.localDate,
        dayOfWeek: input.dayOfWeek,
        isTrainingDay: false,
        targetMuscles: input.defaults.targetMuscles,
        environment: input.defaults.environment,
        availableEquipment: input.defaults.availableEquipment,
        durationMinutes: input.defaults.durationMinutes,
        protocolPreference: input.defaults.protocolPreference,
        inheritedFields: ['TARGET_MUSCLES', 'ENVIRONMENT', 'EQUIPMENT', 'DURATION', 'PROTOCOL']
      };
    }

    const targetMuscles = day.targetMusclesMode === TrainingScheduleOverrideMode.CUSTOM
      ? day.targetMuscles
      : this.inherit(inheritedFields, 'TARGET_MUSCLES', input.defaults.targetMuscles);
    const environment = day.environmentMode === TrainingScheduleOverrideMode.CUSTOM
      ? day.environment
      : this.inherit(inheritedFields, 'ENVIRONMENT', input.defaults.environment);
    const availableEquipment = day.equipmentMode === TrainingScheduleOverrideMode.CUSTOM
      ? day.availableEquipment
      : this.inherit(inheritedFields, 'EQUIPMENT', input.defaults.availableEquipment);
    const durationMinutes = day.durationMode === TrainingScheduleOverrideMode.CUSTOM
      ? day.durationMinutes ?? input.defaults.durationMinutes
      : this.inherit(inheritedFields, 'DURATION', input.defaults.durationMinutes);
    const protocolPreference = day.protocolMode === TrainingScheduleOverrideMode.CUSTOM
      ? day.protocolPreference
      : this.inherit(inheritedFields, 'PROTOCOL', input.defaults.protocolPreference);

    return {
      source: input.source,
      localDate: input.localDate,
      dayOfWeek: input.dayOfWeek,
      isTrainingDay: day.isTrainingDay,
      targetMuscles,
      environment,
      availableEquipment,
      durationMinutes,
      protocolPreference,
      inheritedFields
    };
  }

  getOrderedDays() {
    return ORDERED_DAYS;
  }

  mapAvailableExerciseEquipment(equipment: TrainingEquipment[]) {
    const mapped = new Set<ExerciseEquipment>();
    if (equipment.includes(TrainingEquipment.BODYWEIGHT)) mapped.add(ExerciseEquipment.BODYWEIGHT);
    if (equipment.includes(TrainingEquipment.DUMBBELLS)) mapped.add(ExerciseEquipment.DUMBBELLS);
    if (equipment.includes(TrainingEquipment.MACHINES)) mapped.add(ExerciseEquipment.MACHINES);
    return [...mapped];
  }

  private mapEnvironment(equipment: TrainingEquipment[]) {
    if (equipment.includes(TrainingEquipment.GYM)) return TrainingEnvironment.GYM;
    if (equipment.includes(TrainingEquipment.HOME)) return TrainingEnvironment.HOME;
    return null;
  }

  private getDefaultDuration(schedules: LegacyScheduleItem[], noTrainingPlanned: boolean) {
    if (noTrainingPlanned) return 15;
    return schedules.length ? Math.max(...schedules.map((item) => item.durationMinutes)) : 30;
  }

  private getDayOfWeek(planLocalDate: string) {
    const day = new Date(`${planLocalDate}T00:00:00Z`).getUTCDay();
    const byJsDay: Record<number, TrainingScheduleDayOfWeek> = {
      0: TrainingScheduleDayOfWeek.SUNDAY,
      1: TrainingScheduleDayOfWeek.MONDAY,
      2: TrainingScheduleDayOfWeek.TUESDAY,
      3: TrainingScheduleDayOfWeek.WEDNESDAY,
      4: TrainingScheduleDayOfWeek.THURSDAY,
      5: TrainingScheduleDayOfWeek.FRIDAY,
      6: TrainingScheduleDayOfWeek.SATURDAY
    };
    return byJsDay[day];
  }

  private inherit<T>(
    fields: TrainingScheduleInheritedField[],
    field: TrainingScheduleInheritedField,
    value: T
  ) {
    fields.push(field);
    return value;
  }

  private logResolution(context: ResolvedTrainingDayContext) {
    this.logger.log([
      `training schedule resolved; source=${context.source}`,
      `dayOfWeek=${context.dayOfWeek}`,
      `isTrainingDay=${context.isTrainingDay}`,
      `inherited=${context.inheritedFields.join(',') || 'none'}`,
      `equipment=${context.availableEquipment.join(',') || 'none'}`
    ].join('; '));
  }
}
