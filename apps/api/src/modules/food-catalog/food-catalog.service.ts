import { Injectable, NotFoundException } from '@nestjs/common';
import { DietType, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { isFoodCatalogDietCompatible } from './food-catalog-diet-policy';
import { FOOD_CATALOG_ENGLISH_LOCALE, toFoodCatalogLocale } from './food-catalog-locale';
import { normalizeFoodName, normalizeFoodRestrictions } from './food-catalog-restrictions';
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
    const restrictions = normalizeFoodRestrictions(input.restrictions);

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
    return isFoodCatalogDietCompatible(
      dietType,
      record.dietTypes,
      record.carbsPer100g.toNumber()
    );
  }

  private matchesRestriction(record: FoodCatalogRecord, restrictions: ReturnType<typeof normalizeFoodRestrictions>) {
    if (!restrictions.exactNames.length && !restrictions.tags.length) return false;
    if (record.restrictionTags.some((tag) => restrictions.tags.includes(tag))) return true;
    const labels = record.translations.flatMap((translation) => [translation.name, ...translation.aliases]);
    return labels.some((label) => restrictions.exactNames.some((restriction) => sameFood(label, restriction)));
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
      dietTypes: record.dietTypes,
      restrictionTags: record.restrictionTags,
      aliases: translation.aliases
    };
  }
}

function sameFood(candidate: string, restriction: string) {
  const normalizedCandidate = normalizeFoodName(candidate);
  if (normalizedCandidate === restriction) return true;

  // Users usually enter a base food name (for example, "couscous"), while
  // catalog labels may include a preparation qualifier such as "Cooked couscous".
  return normalizedCandidate.split(' ').some((_, index, words) => (
    words.slice(index, index + restriction.split(' ').length).join(' ') === restriction
  ));
}

function roundDecimal(value: number) {
  return Math.round(value * 10) / 10;
}
