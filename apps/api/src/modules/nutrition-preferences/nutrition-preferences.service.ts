import { Injectable } from '@nestjs/common';
import { DietType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { SafetyService } from '../safety/safety.service';
import { UpsertNutritionPreferencesDto } from './dto/upsert-nutrition-preferences.dto';

@Injectable()
export class NutritionPreferencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly safetyService: SafetyService
  ) {}

  async upsertPreferences(userId: string, dto: UpsertNutritionPreferencesDto) {
    const allergies = this.normalizeList(dto.allergies);
    const excludedFoods = this.normalizeList(dto.excludedFoods);
    const preferredFoods = this.normalizeList(dto.preferredFoods);

    this.safetyService.validateNutritionPreferences({
      allergies,
      excludedFoods,
      preferredFoods
    });

    return this.prisma.$transaction(async (tx) => {
      const dietType = dto.dietType ?? DietType.NONE;
      const mealsPerDay = dto.mealsPerDay ?? 3;
      const noKnownAllergiesConfirmed =
        allergies.length === 0 ? Boolean(dto.noKnownAllergiesConfirmed) : false;

      const preference = await tx.nutritionPreference.upsert({
        where: { userId },
        update: {
          dietType,
          mealsPerDay,
          noKnownAllergiesConfirmed,
          notes: dto.notes
        },
        create: {
          userId,
          dietType,
          mealsPerDay,
          noKnownAllergiesConfirmed,
          notes: dto.notes
        }
      });

      await tx.allergy.deleteMany({ where: { nutritionPreferenceId: preference.id } });
      await tx.excludedFood.deleteMany({ where: { nutritionPreferenceId: preference.id } });
      await tx.preferredFood.deleteMany({ where: { nutritionPreferenceId: preference.id } });

      if (allergies.length > 0) {
        await tx.allergy.createMany({
          data: allergies.map((name) => ({ nutritionPreferenceId: preference.id, name }))
        });
      }

      if (excludedFoods.length > 0) {
        await tx.excludedFood.createMany({
          data: excludedFoods.map((name) => ({ nutritionPreferenceId: preference.id, name }))
        });
      }

      if (preferredFoods.length > 0) {
        await tx.preferredFood.createMany({
          data: preferredFoods.map((name) => ({ nutritionPreferenceId: preference.id, name }))
        });
      }

      return tx.nutritionPreference.findUniqueOrThrow({
        where: { id: preference.id },
        include: {
          allergies: true,
          excludedFoods: true,
          preferredFoods: true
        }
      });
    });
  }

  private normalizeList(values?: string[]) {
    return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
  }
}
