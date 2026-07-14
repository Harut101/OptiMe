import { Injectable } from '@nestjs/common';
import { FoodCatalogCategory } from '@prisma/client';

import { FoodCatalogService } from './food-catalog.service';
import type {
  DailyFoodCatalogSelection,
  FoodCatalogCandidate,
  FoodCatalogSelectionRole,
  SelectDailyFoodCatalogInput
} from './food-catalog.types';
import { FOOD_CATALOG_SELECTION_ROLES } from './food-catalog.types';

const ROLE_CATEGORIES: Record<FoodCatalogSelectionRole, FoodCatalogCategory[]> = {
  BREAKFAST_BASE: [
    FoodCatalogCategory.GRAIN,
    FoodCatalogCategory.DAIRY_OR_ALTERNATIVE,
    FoodCatalogCategory.PROTEIN,
    FoodCatalogCategory.LEGUME
  ],
  MAIN_PROTEIN: [FoodCatalogCategory.PROTEIN, FoodCatalogCategory.LEGUME],
  CARBOHYDRATE: [FoodCatalogCategory.GRAIN, FoodCatalogCategory.LEGUME],
  VEGETABLE: [FoodCatalogCategory.VEGETABLE],
  FRUIT: [FoodCatalogCategory.FRUIT],
  FAT: [FoodCatalogCategory.FAT],
  DAIRY_OR_ALTERNATIVE: [FoodCatalogCategory.DAIRY_OR_ALTERNATIVE]
};

@Injectable()
export class FoodCatalogSelectionService {
  constructor(private readonly foodCatalog: FoodCatalogService) {}

  /**
   * Gives the nutrition agent a small, safe, date-varied subset instead of a
   * flat catalog dump. The full catalog remains the source of truth.
   */
  async selectForDailyPlan(input: SelectDailyFoodCatalogInput): Promise<DailyFoodCatalogSelection> {
    const maxPerRole = Math.min(Math.max(Math.trunc(input.maxPerRole ?? 5), 2), 8);
    const allCandidates = await this.foodCatalog.listAllowedCandidates({
      locale: input.locale,
      dietType: input.dietType,
      restrictions: input.restrictions,
      limit: 160
    });
    const preferredFoods = normalizePreferenceTerms(input.preferredFoods ?? []);
    const byRole = {} as DailyFoodCatalogSelection['byRole'];

    for (const role of FOOD_CATALOG_SELECTION_ROLES) {
      const candidatesForRole = allCandidates.filter((candidate) => ROLE_CATEGORIES[role].includes(candidate.category));
      byRole[role] = rankCandidates(candidatesForRole, role, input.planLocalDate, preferredFoods).slice(0, maxPerRole);
    }

    const candidates = deduplicateCandidates(FOOD_CATALOG_SELECTION_ROLES.flatMap((role) => byRole[role]));
    return { candidates, byRole };
  }
}

function rankCandidates(
  candidates: FoodCatalogCandidate[],
  role: FoodCatalogSelectionRole,
  planLocalDate: string,
  preferredFoods: string[]
) {
  return [...candidates].sort((left, right) => {
    const preferenceDelta = Number(matchesPreference(right, preferredFoods)) - Number(matchesPreference(left, preferredFoods));
    if (preferenceDelta !== 0) return preferenceDelta;

    const leftScore = stableScore(`${planLocalDate}:${role}:${left.slug}`);
    const rightScore = stableScore(`${planLocalDate}:${role}:${right.slug}`);
    if (leftScore !== rightScore) return leftScore - rightScore;
    return left.slug.localeCompare(right.slug);
  });
}

function matchesPreference(candidate: FoodCatalogCandidate, preferredFoods: string[]) {
  if (!preferredFoods.length) return false;
  const labels = [candidate.slug, candidate.name, ...candidate.aliases].map(normalizeTerm);
  return preferredFoods.some((preference) => labels.some((label) => label.includes(preference) || preference.includes(label)));
}

function normalizePreferenceTerms(values: string[]) {
  return values.map(normalizeTerm).filter((value) => value.length >= 2);
}

function normalizeTerm(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function stableScore(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deduplicateCandidates(candidates: FoodCatalogCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.slug)) return false;
    seen.add(candidate.slug);
    return true;
  });
}
