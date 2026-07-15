import { Injectable } from '@nestjs/common';
import { DietType } from '@prisma/client';
import type { SupportedLocale } from '@optime/shared-types';

import { FoodCatalogService } from './food-catalog.service';
import { groupFoodCatalogCandidatesByRole } from './food-catalog-selection.service';
import { FOOD_CATALOG_SELECTION_ROLES, type FoodCatalogSelectionRole } from './food-catalog.types';

export type FoodCatalogCoverageStatus = 'READY' | 'LIMITED' | 'BLOCKED';

export interface FoodCatalogCoverageScenario {
  id: 'OMNIVORE' | 'VEGETARIAN' | 'VEGAN' | 'PESCATARIAN';
  dietType: DietType;
  requiredRoles: FoodCatalogSelectionRole[];
}

export interface FoodCatalogCoverageResult {
  locale: SupportedLocale;
  scenarios: Array<{
    id: FoodCatalogCoverageScenario['id'];
    dietType: DietType;
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
