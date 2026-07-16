import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { FoodCatalogModule } from '../food-catalog/food-catalog.module';
import { CatalogFallbackFoodPlanService } from './catalog-fallback-food-plan.service';
import { FoodPlanCatalogFeasibilityService } from './food-plan-catalog-feasibility.service';
import { FoodPlanCatalogRebalancerService } from './food-plan-catalog-rebalancer.service';
import { FoodPlanPortionSolverService } from './food-plan-portion-solver.service';
import { FoodPlanRecipeTemplateService } from './food-plan-recipe-template.service';
import { FoodPlanValidationService } from './food-plan-validation.service';
import { NutritionAgentService } from './nutrition-agent.service';

@Module({
  imports: [AiModule, FoodCatalogModule],
  providers: [
    CatalogFallbackFoodPlanService,
    FoodPlanCatalogFeasibilityService,
    FoodPlanCatalogRebalancerService,
    FoodPlanPortionSolverService,
    FoodPlanRecipeTemplateService,
    FoodPlanValidationService,
    NutritionAgentService
  ],
  exports: [FoodPlanValidationService, NutritionAgentService]
})
export class NutritionAgentModule {}
