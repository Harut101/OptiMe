import { Injectable } from '@nestjs/common';

import {
  type DailyFoodCatalogSelection,
  type FoodCatalogCandidate,
  type FoodCatalogSelectionRole
} from '../food-catalog/food-catalog.types';
import type { FoodPlanPortionSolverTarget } from './food-plan-portion-solver.service';

export type FoodPlanCatalogFeasibilityStatus = 'FEASIBLE' | 'LIMITED' | 'UNAVAILABLE';

export interface FoodPlanCatalogFeasibilityInput {
  target: FoodPlanPortionSolverTarget;
  catalogSelection: DailyFoodCatalogSelection;
}

export interface FoodPlanCatalogFeasibilityResult {
  status: FoodPlanCatalogFeasibilityStatus;
  reasonCodes: string[];
  safeCandidateCount: number;
}

@Injectable()
export class FoodPlanCatalogFeasibilityService {
  /**
   * This is intentionally conservative: UNAVAILABLE is reserved for conditions
   * the allowed catalog cannot solve at all. Limited plans still reach the AI.
   */
  assess(input: FoodPlanCatalogFeasibilityInput): FoodPlanCatalogFeasibilityResult {
    const candidates = input.catalogSelection.candidates;
    const unavailableReasons = [
      ...(candidates.length < 3 ? ['CATALOG_SAFE_CANDIDATES_UNAVAILABLE'] : []),
      ...(!hasNutrientSource(candidates, 'caloriesKcal') ? ['CATALOG_CALORIE_SOURCE_UNAVAILABLE'] : []),
      ...(requiresSource(input.target.proteinGrams) && !hasNutrientSource(candidates, 'proteinGrams')
        ? ['CATALOG_PROTEIN_SOURCE_UNAVAILABLE']
        : []),
      ...(requiresSource(input.target.carbsGrams) && !hasNutrientSource(candidates, 'carbsGrams')
        ? ['CATALOG_CARBOHYDRATE_SOURCE_UNAVAILABLE']
        : []),
      ...(requiresSource(input.target.fatGrams) && !hasNutrientSource(candidates, 'fatGrams')
        ? ['CATALOG_FAT_SOURCE_UNAVAILABLE']
        : [])
    ];

    if (unavailableReasons.length) {
      return {
        status: 'UNAVAILABLE',
        reasonCodes: unavailableReasons,
        safeCandidateCount: candidates.length
      };
    }

    const limitedReasons = [
      ...roleLimited(input.catalogSelection, 'MAIN_PROTEIN', input.target.proteinGrams > 0),
      ...roleLimited(input.catalogSelection, 'CARBOHYDRATE', input.target.carbsGrams > 20),
      ...roleLimited(input.catalogSelection, 'FAT', input.target.fatGrams > 10)
    ];

    return {
      status: limitedReasons.length ? 'LIMITED' : 'FEASIBLE',
      reasonCodes: limitedReasons,
      safeCandidateCount: candidates.length
    };
  }
}

function hasNutrientSource(
  candidates: FoodCatalogCandidate[],
  nutrient: 'caloriesKcal' | 'proteinGrams' | 'carbsGrams' | 'fatGrams'
) {
  switch (nutrient) {
    case 'caloriesKcal':
      return candidates.some((candidate) => candidate.caloriesPer100g > 0.1);
    case 'proteinGrams':
      return candidates.some((candidate) => candidate.proteinPer100g > 0.1);
    case 'carbsGrams':
      return candidates.some((candidate) => candidate.carbsPer100g > 0.1);
    case 'fatGrams':
      return candidates.some((candidate) => candidate.fatPer100g > 0.1);
  }
}

function requiresSource(targetValue: number) {
  return Number.isFinite(targetValue) && targetValue > 1;
}

function roleLimited(
  selection: DailyFoodCatalogSelection,
  role: FoodCatalogSelectionRole,
  required: boolean
) {
  if (!required || selection.byRole[role].length >= 2) return [];
  return [`CATALOG_${role}_ROLE_LIMITED`];
}
