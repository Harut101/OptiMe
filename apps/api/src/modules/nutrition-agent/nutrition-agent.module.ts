import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { FoodCatalogModule } from '../food-catalog/food-catalog.module';
import { CatalogFallbackFoodPlanService } from './catalog-fallback-food-plan.service';
import { FoodPlanValidationService } from './food-plan-validation.service';
import { NutritionAgentService } from './nutrition-agent.service';

@Module({
  imports: [AiModule, FoodCatalogModule],
  providers: [CatalogFallbackFoodPlanService, FoodPlanValidationService, NutritionAgentService],
  exports: [FoodPlanValidationService, NutritionAgentService]
})
export class NutritionAgentModule {}
