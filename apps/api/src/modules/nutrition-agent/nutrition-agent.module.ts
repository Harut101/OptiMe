import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { FoodPlanValidationService } from './food-plan-validation.service';
import { NutritionAgentService } from './nutrition-agent.service';

@Module({
  imports: [AiModule],
  providers: [FoodPlanValidationService, NutritionAgentService],
  exports: [FoodPlanValidationService, NutritionAgentService]
})
export class NutritionAgentModule {}
