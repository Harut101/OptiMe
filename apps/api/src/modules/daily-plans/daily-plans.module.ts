import { Module } from '@nestjs/common';

import { AiOperationLogsModule } from '../ai-operation-logs/ai-operation-logs.module';
import { AiModule } from '../ai/ai.module';
import { DailyPlanCheckInsModule } from '../daily-plan-check-ins/daily-plan-check-ins.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { ExerciseSelectionModule } from '../exercise-selection/exercise-selection.module';
import { FoodLogsModule } from '../food-logs/food-logs.module';
import { FoodAvailabilityModule } from '../food-availability/food-availability.module';
import { FoodCatalogModule } from '../food-catalog/food-catalog.module';
import { HealthModule } from '../health/health.module';
import { NutritionAgentModule } from '../nutrition-agent/nutrition-agent.module';
import { NutritionTargetsModule } from '../nutrition-targets/nutrition-targets.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { ProtocolModule } from '../protocol/protocol.module';
import { SafetyAgentModule } from '../safety-agent/safety-agent.module';
import { SafetyModule } from '../safety/safety.module';
import { TrainingLoadAgentModule } from '../training-load-agent/training-load-agent.module';
import { TrainingScheduleModule } from '../training-schedule/training-schedule.module';
import { UsageModule } from '../usage/usage.module';
import { DailyPlansController } from './daily-plans.controller';
import { DailyPlansService } from './daily-plans.service';
import { FoodIngredientSwapService } from './food-ingredient-swap.service';
import { PainAwareExerciseReplacementService } from './pain-aware-exercise-replacement.service';

@Module({
  imports: [
    AiOperationLogsModule,
    AiModule,
    DailyPlanCheckInsModule,
    EntitlementsModule,
    ExerciseSelectionModule,
    FoodLogsModule,
    FoodAvailabilityModule,
    FoodCatalogModule,
    HealthModule,
    NutritionAgentModule,
    NutritionTargetsModule,
    OnboardingModule,
    ProtocolModule,
    SafetyModule,
    SafetyAgentModule,
    TrainingLoadAgentModule,
    TrainingScheduleModule,
    UsageModule
  ],
  controllers: [DailyPlansController],
  providers: [DailyPlansService, PainAwareExerciseReplacementService, FoodIngredientSwapService],
  exports: [DailyPlansService]
})
export class DailyPlansModule {}
