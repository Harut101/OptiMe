import { Injectable } from '@nestjs/common';
import { DietType } from '@prisma/client';
import type { SupportedLocale } from '@optime/shared-types';

import { FoodCatalogService } from './food-catalog.service';
import { groupFoodCatalogCandidatesByRole } from './food-catalog-selection.service';
import {
  FOOD_CATALOG_SELECTION_ROLES,
  type FoodCatalogRestrictions,
  type FoodCatalogSelectionRole
} from './food-catalog.types';

export type FoodCatalogCoverageStatus = 'READY' | 'LIMITED' | 'BLOCKED';

export interface FoodCatalogCoverageScenario {
  id: FoodCatalogCoverageScenarioId;
  dietType: DietType;
  requiredRoles: FoodCatalogSelectionRole[];
  restrictions?: FoodCatalogRestrictions;
}

export type FoodCatalogCoverageScenarioId =
  | 'OMNIVORE'
  | 'VEGETARIAN'
  | 'VEGAN'
  | 'PESCATARIAN'
  | 'MEDITERRANEAN'
  | 'LOW_CARB'
  | 'KETO'
  | 'OMNIVORE_DAIRY_AND_FISH_FREE'
  | 'VEGETARIAN_EGG_AND_SOY_FREE'
  | 'VEGAN_SOY_AND_TREE_NUT_FREE'
  | 'GLUTEN_FREE_OMNIVORE'
  | 'LOW_CARB_DAIRY_FREE'
  | 'KETO_DAIRY_AND_TREE_NUT_FREE';

export interface FoodCatalogCoverageResult {
  locale: SupportedLocale;
  scenarios: Array<{
    id: FoodCatalogCoverageScenario['id'];
    dietType: DietType;
    restrictions: FoodCatalogRestrictions;
    status: FoodCatalogCoverageStatus;
    activeCandidateCount: number;
    roleCounts: Record<FoodCatalogSelectionRole, number>;
    missingRoles: FoodCatalogSelectionRole[];
    limitedRoles: FoodCatalogSelectionRole[];
  }>;
}

const COVERAGE_SCENARIOS: FoodCatalogCoverageScenario[] = [
  {
    id: 'OMNIVORE',
    dietType: DietType.OMNIVORE,
    requiredRoles: [...FOOD_CATALOG_SELECTION_ROLES]
  },
  {
    id: 'VEGETARIAN',
    dietType: DietType.VEGETARIAN,
    requiredRoles: [...FOOD_CATALOG_SELECTION_ROLES]
  },
  {
    id: 'VEGAN',
    dietType: DietType.VEGAN,
    requiredRoles: ['BREAKFAST_BASE', 'MAIN_PROTEIN', 'CARBOHYDRATE', 'VEGETABLE', 'FRUIT', 'FAT']
  },
  {
    id: 'PESCATARIAN',
    dietType: DietType.PESCATARIAN,
    requiredRoles: [...FOOD_CATALOG_SELECTION_ROLES]
  },
  {
    id: 'MEDITERRANEAN',
    dietType: DietType.MEDITERRANEAN,
    requiredRoles: [...FOOD_CATALOG_SELECTION_ROLES]
  },
  {
    id: 'LOW_CARB',
    dietType: DietType.LOW_CARB,
    requiredRoles: ['MAIN_PROTEIN', 'VEGETABLE', 'FAT']
  },
  {
    id: 'KETO',
    dietType: DietType.KETO,
    requiredRoles: ['MAIN_PROTEIN', 'VEGETABLE', 'FAT']
  },
  {
    id: 'OMNIVORE_DAIRY_AND_FISH_FREE',
    dietType: DietType.OMNIVORE,
    requiredRoles: ['BREAKFAST_BASE', 'MAIN_PROTEIN', 'CARBOHYDRATE', 'VEGETABLE', 'FRUIT', 'FAT'],
    restrictions: { allergies: ['milk', 'fish'] }
  },
  {
    id: 'VEGETARIAN_EGG_AND_SOY_FREE',
    dietType: DietType.VEGETARIAN,
    requiredRoles: [...FOOD_CATALOG_SELECTION_ROLES],
    restrictions: { allergies: ['egg', 'soy'] }
  },
  {
    id: 'VEGAN_SOY_AND_TREE_NUT_FREE',
    dietType: DietType.VEGAN,
    requiredRoles: ['BREAKFAST_BASE', 'MAIN_PROTEIN', 'CARBOHYDRATE', 'VEGETABLE', 'FRUIT', 'FAT'],
    restrictions: { allergies: ['soy', 'tree nuts'] }
  },
  {
    id: 'GLUTEN_FREE_OMNIVORE',
    dietType: DietType.OMNIVORE,
    requiredRoles: [...FOOD_CATALOG_SELECTION_ROLES],
    restrictions: { allergies: ['gluten'] }
  },
  {
    id: 'LOW_CARB_DAIRY_FREE',
    dietType: DietType.LOW_CARB,
    requiredRoles: ['MAIN_PROTEIN', 'VEGETABLE', 'FAT'],
    restrictions: { allergies: ['milk'] }
  },
  {
    id: 'KETO_DAIRY_AND_TREE_NUT_FREE',
    dietType: DietType.KETO,
    requiredRoles: ['MAIN_PROTEIN', 'VEGETABLE', 'FAT'],
    restrictions: { allergies: ['milk', 'tree nuts'] }
  }
];

@Injectable()
export class FoodCatalogCoverageService {
  constructor(private readonly foodCatalog: FoodCatalogService) {}

  /**
   * Reports catalog readiness without generating or changing a user plan.
   * A role with one candidate is safe but has no rotation, so it is LIMITED.
   */
  async audit(locale: SupportedLocale = 'en-US'): Promise<FoodCatalogCoverageResult> {
    const scenarios = await Promise.all(COVERAGE_SCENARIOS.map(async (scenario) => {
      const candidates = await this.foodCatalog.listAllowedCandidates({
        locale,
        dietType: scenario.dietType,
        restrictions: scenario.restrictions,
        limit: 160
      });
      const byRole = groupFoodCatalogCandidatesByRole(candidates);
      const roleCounts = Object.fromEntries(
        FOOD_CATALOG_SELECTION_ROLES.map((role) => [role, byRole[role].length])
      ) as Record<FoodCatalogSelectionRole, number>;
      const missingRoles = scenario.requiredRoles.filter((role) => roleCounts[role] === 0);
      const limitedRoles = scenario.requiredRoles.filter((role) => roleCounts[role] === 1);

      const status: FoodCatalogCoverageStatus = missingRoles.length
        ? 'BLOCKED'
        : limitedRoles.length
          ? 'LIMITED'
          : 'READY';

      return {
        id: scenario.id,
        dietType: scenario.dietType,
        restrictions: scenario.restrictions ?? {},
        status,
        activeCandidateCount: candidates.length,
        roleCounts,
        missingRoles,
        limitedRoles
      };
    }));

    return { locale, scenarios };
  }
}
