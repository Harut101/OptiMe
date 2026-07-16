import { Injectable } from '@nestjs/common';
import type { DailyFoodPlan } from '@optime/shared-types';

import {
  CatalogFallbackFoodPlanService,
  type CatalogFoodPlanComposeOptions
} from './catalog-fallback-food-plan.service';
import type { NutritionAgentInput } from './nutrition-agent.types';

@Injectable()
export class FoodPlanRecipeComposerService {
  constructor(private readonly catalogFallbackFoodPlan: CatalogFallbackFoodPlanService) {}

  /**
   * Composes a complete candidate plan from safe catalog foods and deterministic
   * recipe templates. It intentionally owns ingredients and nutrition, leaving
   * the AI only user-facing meal copy to improve.
   */
  compose(
    input: NutritionAgentInput,
    options?: CatalogFoodPlanComposeOptions
  ): Promise<DailyFoodPlan | null> {
    return this.catalogFallbackFoodPlan.compose(input, [], 'NUTRITION_AGENT', options);
  }
}
