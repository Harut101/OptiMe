import { Injectable } from '@nestjs/common';
import {
  Prisma,
  TargetMuscleGroup,
  TrainingEquipment,
  TrainingLevel,
  TrainingOutcome
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { UpsertTrainingPreferenceDto } from './dto/upsert-training-preference.dto';

type TrainingPreferenceWriteData = Partial<{
  targetMuscleGroups: TargetMuscleGroup[];
  trainingOutcome: TrainingOutcome | null;
  equipment: TrainingEquipment[];
  trainingLevel: TrainingLevel | null;
  limitationsOrPainAreas: string[];
  preferredTrainingDays: number[];
}>;

const EMPTY_TRAINING_PREFERENCE: Required<TrainingPreferenceWriteData> = {
  targetMuscleGroups: [],
  trainingOutcome: null,
  equipment: [],
  trainingLevel: null,
  limitationsOrPainAreas: [],
  preferredTrainingDays: []
};

@Injectable()
export class TrainingPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async getForUser(userId: string) {
    const preference = await this.prisma.trainingPreference.findUnique({
      where: { userId }
    });

    return preference ? this.toResponse(preference) : EMPTY_TRAINING_PREFERENCE;
  }

  async upsertForUser(userId: string, dto: UpsertTrainingPreferenceDto) {
    const data = this.toPrismaUpdateData(dto);

    const preference = await this.prisma.trainingPreference.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        ...EMPTY_TRAINING_PREFERENCE,
        ...data
      }
    });

    return this.toResponse(preference);
  }

  async updatePartial(
    tx: Prisma.TransactionClient,
    userId: string,
    data: TrainingPreferenceWriteData
  ) {
    await tx.trainingPreference.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        ...EMPTY_TRAINING_PREFERENCE,
        ...data
      }
    });
  }

  private toPrismaUpdateData(dto: UpsertTrainingPreferenceDto): TrainingPreferenceWriteData {
    return {
      ...(dto.targetMuscleGroups !== undefined
        ? { targetMuscleGroups: dto.targetMuscleGroups }
        : {}),
      ...(dto.trainingOutcome !== undefined ? { trainingOutcome: dto.trainingOutcome } : {}),
      ...(dto.equipment !== undefined ? { equipment: dto.equipment } : {}),
      ...(dto.trainingLevel !== undefined ? { trainingLevel: dto.trainingLevel } : {}),
      ...(dto.limitationsOrPainAreas !== undefined
        ? { limitationsOrPainAreas: this.normalizeStringList(dto.limitationsOrPainAreas) }
        : {}),
      ...(dto.preferredTrainingDays !== undefined
        ? { preferredTrainingDays: dto.preferredTrainingDays }
        : {})
    };
  }

  private toResponse(preference: {
    targetMuscleGroups: string[];
    trainingOutcome: string | null;
    equipment: string[];
    trainingLevel: string | null;
    limitationsOrPainAreas: string[];
    preferredTrainingDays: number[];
  }) {
    return {
      targetMuscleGroups: preference.targetMuscleGroups,
      trainingOutcome: preference.trainingOutcome,
      equipment: preference.equipment,
      trainingLevel: preference.trainingLevel,
      limitationsOrPainAreas: preference.limitationsOrPainAreas,
      preferredTrainingDays: preference.preferredTrainingDays
    };
  }

  private normalizeStringList(values: string[]) {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, 20);
  }
}
