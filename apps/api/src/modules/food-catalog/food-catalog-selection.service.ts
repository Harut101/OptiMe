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

export const FOOD_CATALOG_ROLE_CATEGORIES: Record<FoodCatalogSelectionRole, FoodCatalogCategory[]> = {
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
    const availableFoodSlugs = new Set(input.availableFoodSlugs ?? []);
    const preparationPriorityRoles = new Set(input.prioritizePreparationForRoles ?? []);
    const candidatesByRole = groupFoodCatalogCandidatesByRole(allCandidates);
    const byRole = {} as DailyFoodCatalogSelection['byRole'];

    for (const role of FOOD_CATALOG_SELECTION_ROLES) {
      byRole[role] = rankCandidates(
        candidatesByRole[role],
        role,
        input.planLocalDate,
        availableFoodSlugs,
        preferredFoods,
        preparationPriorityRoles.has(role)
      ).slice(0, maxPerRole);
    }

    const candidates = deduplicateCandidates(FOOD_CATALOG_SELECTION_ROLES.flatMap((role) => byRole[role]));
    return { candidates, byRole };
  }
}

export function groupFoodCatalogCandidatesByRole(candidates: FoodCatalogCandidate[]) {
  const byRole = {} as Record<FoodCatalogSelectionRole, FoodCatalogCandidate[]>;
  for (const role of FOOD_CATALOG_SELECTION_ROLES) {
    byRole[role] = candidates.filter((candidate) => FOOD_CATALOG_ROLE_CATEGORIES[role].includes(candidate.category));
  }
  return byRole;
}

function rankCandidates(
  candidates: FoodCatalogCandidate[],
  role: FoodCatalogSelectionRole,
  planLocalDate: string,
  availableFoodSlugs: Set<string>,
  preferredFoods: string[],
  prioritizePreparation: boolean
) {
  return [...candidates].sort((left, right) => {
    const categoryDelta = roleCategoryRank(role, left.category) - roleCategoryRank(role, right.category);
    if (categoryDelta !== 0) return categoryDelta;

    const availabilityDelta = Number(availableFoodSlugs.has(right.slug)) - Number(availableFoodSlugs.has(left.slug));
    if (availabilityDelta !== 0) return availabilityDelta;

    const preferenceDelta = Number(matchesPreference(right, preferredFoods)) - Number(matchesPreference(left, preferredFoods));
    if (preferenceDelta !== 0) return preferenceDelta;

    if (prioritizePreparation) {
      const preparationDelta = preparationRank(left.preparationLevel) - preparationRank(right.preparationLevel);
      if (preparationDelta !== 0) return preparationDelta;
    }

    const leftScore = stableScore(`${planLocalDate}:${role}:${left.slug}`);
    const rightScore = stableScore(`${planLocalDate}:${role}:${right.slug}`);
    if (leftScore !== rightScore) return leftScore - rightScore;
    return left.slug.localeCompare(right.slug);
  });
}

function roleCategoryRank(role: FoodCatalogSelectionRole, category: FoodCatalogCategory) {
  const rank = FOOD_CATALOG_ROLE_CATEGORIES[role].indexOf(category);
  return rank === -1 ? Number.MAX_SAFE_INTEGER : rank;
}

function preparationRank(level: FoodCatalogCandidate['preparationLevel']) {
  if (level === 'READY_TO_EAT') return 0;
  if (level === 'QUICK_ASSEMBLY') return 1;
  return 2;
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
