import { Module } from '@nestjs/common';

import { AiOperationLogsModule } from '../ai-operation-logs/ai-operation-logs.module';
import { DailyPlanCheckInsModule } from '../daily-plan-check-ins/daily-plan-check-ins.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { FoodAvailabilityModule } from '../food-availability/food-availability.module';
import { FoodLogsModule } from '../food-logs/food-logs.module';
import { HealthModule } from '../health/health.module';
import { NutritionTargetsModule } from '../nutrition-targets/nutrition-targets.module';
import { ProtocolModule } from '../protocol/protocol.module';
import { RecoveryPlanAgentModule } from '../recovery-plan-agent/recovery-plan-agent.module';
import { SafetyAgentModule } from '../safety-agent/safety-agent.module';
import { SafetyModule } from '../safety/safety.module';
import { TrainingPlanAgentModule } from '../training-plan-agent/training-plan-agent.module';
import { TrainingScheduleModule } from '../training-schedule/training-schedule.module';
import { DailyPlanGenerationContextService } from './daily-plan-generation-context.service';
import { DailyPlanOrchestratorService } from './daily-plan-orchestrator.service';
import { DailyPlanPersistenceService } from './daily-plan-persistence.service';
import { DailyPlanSafetyOrchestratorService } from './daily-plan-safety-orchestrator.service';

@Module({
  imports: [
    AiOperationLogsModule,
    DailyPlanCheckInsModule,
    EntitlementsModule,
    FoodAvailabilityModule,
    FoodLogsModule,
    HealthModule,
    NutritionTargetsModule,
    ProtocolModule,
    RecoveryPlanAgentModule,
    SafetyAgentModule,
    SafetyModule,
    TrainingPlanAgentModule,
    TrainingScheduleModule
  ],
  providers: [
    DailyPlanOrchestratorService,
    DailyPlanGenerationContextService,
    DailyPlanPersistenceService,
    DailyPlanSafetyOrchestratorService
  ],
  exports: [DailyPlanOrchestratorService]
})
export class DailyPlanOrchestratorModule {}
