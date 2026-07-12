import { Injectable, NotFoundException } from '@nestjs/common';
import { DietType, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { FOOD_CATALOG_ENGLISH_LOCALE, toFoodCatalogLocale } from './food-catalog-locale';
import type {
  FoodCatalogCandidate,
  FoodCatalogNutrition,
  ListFoodCatalogCandidatesInput
} from './food-catalog.types';

const catalogInclude = {
  translations: true
} satisfies Prisma.FoodCatalogItemInclude;

type FoodCatalogRecord = Prisma.FoodCatalogItemGetPayload<{ include: typeof catalogInclude }>;

@Injectable()
export class FoodCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listAllowedCandidates(input: ListFoodCatalogCandidatesInput): Promise<FoodCatalogCandidate[]> {
    const records = await this.prisma.foodCatalogItem.findMany({
      where: { isActive: true },
      include: catalogInclude,
      orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }]
    });
    const restrictions = normalizeRestrictions(input.restrictions);

    return records
      .filter((record) => this.isDietCompatible(record, input.dietType))
      .filter((record) => !this.matchesRestriction(record, restrictions))
      .slice(0, Math.min(Math.max(input.limit ?? 80, 1), 160))
      .map((record) => this.toCandidate(record, input.locale));
  }

  async getBySlug(slug: string, locale: ListFoodCatalogCandidatesInput['locale']) {
    const record = await this.prisma.foodCatalogItem.findUnique({
      where: { slug },
      include: catalogInclude
    });
    if (!record || !record.isActive) {
      throw new NotFoundException('Food catalog item not found.');
    }
    return this.toCandidate(record, locale);
  }

  calculateNutrition(candidate: FoodCatalogCandidate, grams: number): FoodCatalogNutrition {
    if (!Number.isFinite(grams) || grams <= 0) {
      throw new Error('Ingredient grams must be a positive finite number.');
    }
    const multiplier = grams / 100;
    return {
      caloriesKcal: Math.round(candidate.caloriesPer100g * multiplier),
      proteinGrams: roundDecimal(candidate.proteinPer100g * multiplier),
      carbsGrams: roundDecimal(candidate.carbsPer100g * multiplier),
      fatGrams: roundDecimal(candidate.fatPer100g * multiplier),
      fiberGrams: candidate.fiberPer100g === null ? null : roundDecimal(candidate.fiberPer100g * multiplier)
    };
  }

  private isDietCompatible(record: FoodCatalogRecord, dietType?: DietType | null) {
    if (
      !dietType
      || dietType === DietType.NONE
      || dietType === DietType.OMNIVORE
      || dietType === DietType.KETO
      || dietType === DietType.LOW_CARB
      || dietType === DietType.MEDITERRANEAN
      || dietType === DietType.HALAL
      || dietType === DietType.KOSHER
    ) {
      return true;
    }
    return record.dietTypes.includes(dietType);
  }

  private matchesRestriction(record: FoodCatalogRecord, restrictions: string[]) {
    if (!restrictions.length) return false;
    const labels = record.translations.flatMap((translation) => [translation.name, ...translation.aliases]);
    return labels.some((label) => restrictions.some((restriction) => sameFood(label, restriction)));
  }

  private toCandidate(record: FoodCatalogRecord, locale: ListFoodCatalogCandidatesInput['locale']): FoodCatalogCandidate {
    const requestedLocale = toFoodCatalogLocale(locale);
    const translation = record.translations.find((item) => item.locale === requestedLocale)
      ?? record.translations.find((item) => item.locale === FOOD_CATALOG_ENGLISH_LOCALE);
    if (!translation) {
      throw new Error(`Food catalog item is missing its English translation: ${record.slug}`);
    }

    return {
      id: record.id,
      slug: record.slug,
      name: translation.name,
      category: record.category,
      caloriesPer100g: record.caloriesPer100g,
      proteinPer100g: record.proteinPer100g.toNumber(),
      carbsPer100g: record.carbsPer100g.toNumber(),
      fatPer100g: record.fatPer100g.toNumber(),
      fiberPer100g: record.fiberPer100g?.toNumber() ?? null,
      dietTypes: record.dietTypes
    };
  }
}

function normalizeRestrictions(input?: {
  allergies?: string[];
  excludedFoods?: string[];
  dislikedFoods?: string[];
}) {
  return [...(input?.allergies ?? []), ...(input?.excludedFoods ?? []), ...(input?.dislikedFoods ?? [])]
    .map((value) => normalizeFoodName(value))
    .filter(Boolean);
}

function sameFood(candidate: string, restriction: string) {
  return normalizeFoodName(candidate) === restriction;
}

function normalizeFoodName(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function roundDecimal(value: number) {
  return Math.round(value * 10) / 10;
}
