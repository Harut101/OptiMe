import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { DailyPlanOrchestratorModule } from '../daily-plan-orchestrator/daily-plan-orchestrator.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { FoodAvailabilityModule } from '../food-availability/food-availability.module';
import { FoodCatalogModule } from '../food-catalog/food-catalog.module';
import { NutritionAgentModule } from '../nutrition-agent/nutrition-agent.module';
import { NutritionTargetsModule } from '../nutrition-targets/nutrition-targets.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { SafetyAgentModule } from '../safety-agent/safety-agent.module';
import { TrainingLoadAgentModule } from '../training-load-agent/training-load-agent.module';
import { TrainingPlanAgentModule } from '../training-plan-agent/training-plan-agent.module';
import { TrainingScheduleModule } from '../training-schedule/training-schedule.module';
import { UsageModule } from '../usage/usage.module';
import { DailyPlansController } from './daily-plans.controller';
import { DailyPlansService } from './daily-plans.service';
import { FoodIngredientSwapService } from './food-ingredient-swap.service';
import { PainAwareExerciseReplacementService } from './pain-aware-exercise-replacement.service';

@Module({
  imports: [
    AiModule,
    DailyPlanOrchestratorModule,
    EntitlementsModule,
    FoodAvailabilityModule,
    FoodCatalogModule,
    NutritionAgentModule,
    NutritionTargetsModule,
    OnboardingModule,
    SafetyAgentModule,
    TrainingLoadAgentModule,
    TrainingPlanAgentModule,
    TrainingScheduleModule,
    UsageModule
  ],
  controllers: [DailyPlansController],
  providers: [DailyPlansService, PainAwareExerciseReplacementService, FoodIngredientSwapService],
  exports: [DailyPlansService]
})
export class DailyPlansModule {}
