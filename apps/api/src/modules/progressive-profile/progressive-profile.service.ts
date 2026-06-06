import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DietType,
  Prisma,
  ProgressiveProfilePromptKey,
  ProgressiveProfilePromptStatus,
  TargetMuscleGroup,
  TrainingEquipment,
  TrainingLevel,
  TrainingOutcome
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { TrainingPreferencesService } from '../training-preferences/training-preferences.service';
import {
  getProgressivePromptDefinition,
  progressivePromptDefinitions
} from './progressive-profile-prompts';

const SKIP_COOLDOWN_HOURS = 24;

type NutritionSummary = {
  dietType?: DietType | null;
  mealsPerDay?: number | null;
  preferredFoods?: Array<{ name: string }>;
  excludedFoods?: Array<{ name: string }>;
};

type TrainingPreferenceSummary = {
  targetMuscleGroups: TargetMuscleGroup[];
  trainingOutcome: TrainingOutcome | null;
  equipment: TrainingEquipment[];
  trainingLevel: TrainingLevel | null;
  limitationsOrPainAreas: string[];
};

@Injectable()
export class ProgressiveProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trainingPreferencesService: TrainingPreferencesService
  ) {}

  async getNextPrompt(userId: string) {
    const summary = await this.getProgressiveProfileSummary(userId);
    const prompt = summary.nextPrompt;

    if (!prompt) {
      return null;
    }

    await this.prisma.userProgressiveProfilePrompt.upsert({
      where: {
        userId_promptKey: {
          userId,
          promptKey: prompt.key as ProgressiveProfilePromptKey
        }
      },
      update: {},
      create: {
        userId,
        promptKey: prompt.key as ProgressiveProfilePromptKey,
        status: ProgressiveProfilePromptStatus.PENDING
      }
    });

    return prompt;
  }

  async getProgressiveProfileSummary(userId: string) {
    const [nutritionPref, trainingPreference, promptStates] = await Promise.all([
      this.prisma.nutritionPreference.findUnique({
        where: { userId },
        select: {
          dietType: true,
          mealsPerDay: true,
          preferredFoods: { select: { name: true } },
          excludedFoods: { select: { name: true } }
        }
      }),
      this.prisma.trainingPreference.findUnique({
        where: { userId },
        select: {
          targetMuscleGroups: true,
          trainingOutcome: true,
          equipment: true,
          trainingLevel: true,
          limitationsOrPainAreas: true
        }
      }),
      this.prisma.userProgressiveProfilePrompt.findMany({
        where: { userId },
        select: {
          promptKey: true,
          status: true,
          skippedUntil: true
        }
      })
    ]);

    const completedPrompts = this.getCompletedPromptKeys(
      nutritionPref,
      trainingPreference,
      promptStates
    );
    const now = new Date();
    const skippedPromptKeys = new Set(
      promptStates
        .filter(
          (prompt) =>
            prompt.status === ProgressiveProfilePromptStatus.SKIPPED &&
            prompt.skippedUntil &&
            prompt.skippedUntil > now
        )
        .map((prompt) => prompt.promptKey)
    );
    const nextPrompt = progressivePromptDefinitions.find(
      (prompt) => !completedPrompts.includes(prompt.key) && !skippedPromptKeys.has(prompt.key)
    );

    return {
      completedPrompts,
      ...(nextPrompt ? { nextPrompt: this.toPromptResponse(nextPrompt) } : {}),
      completionPercent: Math.round(
        (completedPrompts.length / progressivePromptDefinitions.length) * 100
      )
    };
  }

  async answerPrompt(userId: string, key: string, rawValue: unknown) {
    const promptKey = this.parsePromptKey(key);
    const definition = getProgressivePromptDefinition(promptKey);

    if (!definition) {
      throw new NotFoundException('Progressive prompt not found.');
    }

    const value = this.validatePromptValue(definition, rawValue);
    this.validateSafetySensitivePromptValue(promptKey, value);

    await this.prisma.$transaction(async (tx) => {
      await this.applyPromptAnswer(tx, userId, promptKey, value);
      await tx.userProgressiveProfilePrompt.upsert({
        where: {
          userId_promptKey: {
            userId,
            promptKey
          }
        },
        update: {
          status: ProgressiveProfilePromptStatus.ANSWERED,
          answerJson: value as Prisma.InputJsonValue,
          answeredAt: new Date(),
          skippedAt: null,
          skippedUntil: null
        },
        create: {
          userId,
          promptKey,
          status: ProgressiveProfilePromptStatus.ANSWERED,
          answerJson: value as Prisma.InputJsonValue,
          answeredAt: new Date()
        }
      });
    });

    return {
      answered: true,
      promptKey,
      progressiveProfile: await this.getProgressiveProfileSummary(userId)
    };
  }

  async skipPrompt(userId: string, key: string) {
    const promptKey = this.parsePromptKey(key);

    if (!getProgressivePromptDefinition(promptKey)) {
      throw new NotFoundException('Progressive prompt not found.');
    }

    const skippedAt = new Date();
    const skippedUntil = new Date(skippedAt.getTime() + SKIP_COOLDOWN_HOURS * 60 * 60 * 1000);

    await this.prisma.userProgressiveProfilePrompt.upsert({
      where: {
        userId_promptKey: {
          userId,
          promptKey
        }
      },
      update: {
        status: ProgressiveProfilePromptStatus.SKIPPED,
        skippedAt,
        skippedUntil
      },
      create: {
        userId,
        promptKey,
        status: ProgressiveProfilePromptStatus.SKIPPED,
        skippedAt,
        skippedUntil
      }
    });

    return {
      skipped: true,
      promptKey,
      skippedUntil: skippedUntil.toISOString(),
      progressiveProfile: await this.getProgressiveProfileSummary(userId)
    };
  }

  private getCompletedPromptKeys(
    nutritionPref: NutritionSummary | null,
    trainingPreference: TrainingPreferenceSummary | null,
    promptStates: Array<{
      promptKey: ProgressiveProfilePromptKey;
      status: ProgressiveProfilePromptStatus;
    }>
  ) {
    const completed = new Set<ProgressiveProfilePromptKey>(
      promptStates
        .filter((prompt) => prompt.status === ProgressiveProfilePromptStatus.ANSWERED)
        .map((prompt) => prompt.promptKey)
    );

    if ((nutritionPref?.preferredFoods?.length ?? 0) > 0) {
      completed.add(ProgressiveProfilePromptKey.PREFERRED_FOODS);
    }

    if ((nutritionPref?.excludedFoods?.length ?? 0) > 0) {
      completed.add(ProgressiveProfilePromptKey.EXCLUDED_FOODS);
    }

    if (nutritionPref?.dietType && nutritionPref.dietType !== DietType.NONE) {
      completed.add(ProgressiveProfilePromptKey.DIET_TYPE);
    }

    if (nutritionPref?.mealsPerDay) {
      completed.add(ProgressiveProfilePromptKey.MEALS_PER_DAY);
    }

    if ((trainingPreference?.limitationsOrPainAreas.length ?? 0) > 0) {
      completed.add(ProgressiveProfilePromptKey.LIMITATIONS_OR_PAIN_AREAS);
    }

    if ((trainingPreference?.equipment.length ?? 0) > 0) {
      completed.add(ProgressiveProfilePromptKey.EQUIPMENT);
    }

    if (trainingPreference?.trainingLevel) {
      completed.add(ProgressiveProfilePromptKey.TRAINING_LEVEL);
    }

    if ((trainingPreference?.targetMuscleGroups.length ?? 0) > 0) {
      completed.add(ProgressiveProfilePromptKey.TARGET_MUSCLE_GROUPS);
    }

    if (trainingPreference?.trainingOutcome) {
      completed.add(ProgressiveProfilePromptKey.TRAINING_OUTCOME);
    }

    return [...completed];
  }

  private async applyPromptAnswer(
    tx: Prisma.TransactionClient,
    userId: string,
    promptKey: ProgressiveProfilePromptKey,
    value: string | string[] | number | boolean
  ) {
    if (promptKey === ProgressiveProfilePromptKey.PREFERRED_FOODS) {
      await this.mergeFoodList(tx, userId, 'preferred', this.asStringList(value));
      return;
    }

    if (promptKey === ProgressiveProfilePromptKey.EXCLUDED_FOODS) {
      await this.mergeFoodList(tx, userId, 'excluded', this.asStringList(value));
      return;
    }

    if (promptKey === ProgressiveProfilePromptKey.DIET_TYPE && typeof value === 'string') {
      await this.ensureNutritionPreference(tx, userId);
      await tx.nutritionPreference.update({
        where: { userId },
        data: { dietType: value as DietType }
      });
      return;
    }

    if (promptKey === ProgressiveProfilePromptKey.MEALS_PER_DAY && typeof value === 'number') {
      await this.ensureNutritionPreference(tx, userId);
      await tx.nutritionPreference.update({
        where: { userId },
        data: { mealsPerDay: value }
      });
      return;
    }

    if (promptKey === ProgressiveProfilePromptKey.TARGET_MUSCLE_GROUPS) {
      await this.trainingPreferencesService.updatePartial(tx, userId, {
        targetMuscleGroups: this.asStringList(value) as TargetMuscleGroup[]
      });
      return;
    }

    if (promptKey === ProgressiveProfilePromptKey.TRAINING_OUTCOME && typeof value === 'string') {
      await this.trainingPreferencesService.updatePartial(tx, userId, {
        trainingOutcome: value as TrainingOutcome
      });
      return;
    }

    if (promptKey === ProgressiveProfilePromptKey.EQUIPMENT) {
      await this.trainingPreferencesService.updatePartial(tx, userId, {
        equipment: this.asStringList(value) as TrainingEquipment[]
      });
      return;
    }

    if (promptKey === ProgressiveProfilePromptKey.TRAINING_LEVEL && typeof value === 'string') {
      await this.trainingPreferencesService.updatePartial(tx, userId, {
        trainingLevel: value as TrainingLevel
      });
      return;
    }

    if (promptKey === ProgressiveProfilePromptKey.LIMITATIONS_OR_PAIN_AREAS) {
      await this.trainingPreferencesService.updatePartial(tx, userId, {
        limitationsOrPainAreas: this.asStringList(value)
      });
    }
  }

  private async mergeFoodList(
    tx: Prisma.TransactionClient,
    userId: string,
    listType: 'preferred' | 'excluded',
    values: string[]
  ) {
    if (values.length === 0) {
      return;
    }

    const preference = await this.ensureNutritionPreference(tx, userId);
    const existing =
      listType === 'preferred'
        ? await tx.preferredFood.findMany({
            where: { nutritionPreferenceId: preference.id },
            select: { name: true }
          })
        : await tx.excludedFood.findMany({
            where: { nutritionPreferenceId: preference.id },
            select: { name: true }
          });
    const merged = this.uniqueStrings([...existing.map((food) => food.name), ...values]);

    if (listType === 'preferred') {
      await tx.preferredFood.deleteMany({ where: { nutritionPreferenceId: preference.id } });
      await tx.preferredFood.createMany({
        data: merged.map((name) => ({ nutritionPreferenceId: preference.id, name }))
      });
      return;
    }

    await tx.excludedFood.deleteMany({ where: { nutritionPreferenceId: preference.id } });
    await tx.excludedFood.createMany({
      data: merged.map((name) => ({ nutritionPreferenceId: preference.id, name }))
    });
  }

  private ensureNutritionPreference(tx: Prisma.TransactionClient, userId: string) {
    return tx.nutritionPreference.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        dietType: DietType.NONE,
        mealsPerDay: 3
      }
    });
  }

  private parsePromptKey(key: string) {
    const normalizedKey = key.trim().toUpperCase();

    if (!Object.values(ProgressiveProfilePromptKey).includes(normalizedKey as ProgressiveProfilePromptKey)) {
      throw new NotFoundException('Progressive prompt not found.');
    }

    return normalizedKey as ProgressiveProfilePromptKey;
  }

  private validatePromptValue(
    definition: NonNullable<ReturnType<typeof getProgressivePromptDefinition>>,
    rawValue: unknown
  ) {
    if (definition.inputType === 'stringList') {
      const values = this.asStringList(rawValue);

      if (values.length === 0) {
        throw new BadRequestException('Please add at least one answer or skip this prompt for now.');
      }

      return values;
    }

    if (definition.inputType === 'multiSelect') {
      const values = this.asStringList(rawValue);
      const allowedValues = new Set(definition.options?.map((option) => option.value) ?? []);

      if (values.length === 0 || values.some((value) => !allowedValues.has(value))) {
        throw new BadRequestException('Please choose one of the available options.');
      }

      return values;
    }

    if (definition.inputType === 'singleSelect') {
      if (typeof rawValue !== 'string') {
        throw new BadRequestException('Please choose one of the available options.');
      }

      const allowedValues = new Set(definition.options?.map((option) => option.value) ?? []);

      if (!allowedValues.has(rawValue)) {
        throw new BadRequestException('Please choose one of the available options.');
      }

      return rawValue;
    }

    const value = Number(rawValue);

    if (!Number.isFinite(value) || value < 1 || value > 8) {
      throw new BadRequestException('Please enter a number between 1 and 8.');
    }

    return Math.trunc(value);
  }

  private validateSafetySensitivePromptValue(
    promptKey: ProgressiveProfilePromptKey,
    value: string | string[] | number | boolean
  ) {
    if (promptKey !== ProgressiveProfilePromptKey.LIMITATIONS_OR_PAIN_AREAS) {
      return;
    }

    const values = this.asStringList(value);

    if (values.length > 20 || values.some((item) => item.length > 120)) {
      throw new BadRequestException('Please keep limitations or pain areas brief.');
    }
  }

  private asStringList(value: unknown) {
    if (Array.isArray(value)) {
      return this.uniqueStrings(value.map((item) => String(item)));
    }

    if (typeof value === 'string') {
      return this.uniqueStrings(value.split(','));
    }

    return [];
  }

  private uniqueStrings(values: string[]) {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, 30);
  }

  private toPromptResponse(prompt: (typeof progressivePromptDefinitions)[number]) {
    return {
      key: prompt.key,
      title: prompt.title,
      description: prompt.description,
      inputType: prompt.inputType,
      ...(prompt.options ? { options: prompt.options } : {})
    };
  }
}
