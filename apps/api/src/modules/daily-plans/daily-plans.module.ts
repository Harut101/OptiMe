import { Module } from '@nestjs/common';

import { DailyPlanOrchestratorModule } from '../daily-plan-orchestrator/daily-plan-orchestrator.module';
import { FoodCatalogModule } from '../food-catalog/food-catalog.module';
import { NutritionAgentModule } from '../nutrition-agent/nutrition-agent.module';
import { NutritionTargetsModule } from '../nutrition-targets/nutrition-targets.module';
import { DailyPlansController } from './daily-plans.controller';
import { DailyPlansService } from './daily-plans.service';
import { FoodIngredientSwapService } from './food-ingredient-swap.service';

@Module({
  imports: [
    DailyPlanOrchestratorModule,
    FoodCatalogModule,
    NutritionAgentModule,
    NutritionTargetsModule
  ],
  controllers: [DailyPlansController],
  providers: [DailyPlansService, FoodIngredientSwapService],
  exports: [DailyPlansService]
})
export class DailyPlansModule {}
