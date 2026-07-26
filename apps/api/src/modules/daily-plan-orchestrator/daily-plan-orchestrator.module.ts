import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { AiOperationLogsModule } from '../ai-operation-logs/ai-operation-logs.module';
import { DailyPlanCheckInsModule } from '../daily-plan-check-ins/daily-plan-check-ins.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { FoodAvailabilityModule } from '../food-availability/food-availability.module';
import { FoodLogsModule } from '../food-logs/food-logs.module';
import { HealthModule } from '../health/health.module';
import { NutritionAgentModule } from '../nutrition-agent/nutrition-agent.module';
import { NutritionTargetsModule } from '../nutrition-targets/nutrition-targets.module';
import { PlanCheckpointModule } from '../plan-checkpoint/plan-checkpoint.module';
import { ProtocolModule } from '../protocol/protocol.module';
import { RecoveryPlanAgentModule } from '../recovery-plan-agent/recovery-plan-agent.module';
import { SafetyAgentModule } from '../safety-agent/safety-agent.module';
import { SafetyModule } from '../safety/safety.module';
import { TrainingLoadAgentModule } from '../training-load-agent/training-load-agent.module';
import { TrainingPlanAgentModule } from '../training-plan-agent/training-plan-agent.module';
import { TrainingScheduleModule } from '../training-schedule/training-schedule.module';
import { UsageModule } from '../usage/usage.module';
import { DailyPlanAgentExecutionService } from './daily-plan-agent-execution.service';
import { DailyPlanFinalizationService } from './daily-plan-finalization.service';
import { DailyPlanGenerationContextService } from './daily-plan-generation-context.service';
import { DailyPlanOrchestratorService } from './daily-plan-orchestrator.service';
import { DailyPlanPersistenceService } from './daily-plan-persistence.service';
import { DailyPlanSafetyOrchestratorService } from './daily-plan-safety-orchestrator.service';
import { DailyPlanTrainingLoadService } from './daily-plan-training-load.service';

@Module({
  imports: [
    AiModule,
    AiOperationLogsModule,
    DailyPlanCheckInsModule,
    EntitlementsModule,
    FoodAvailabilityModule,
    FoodLogsModule,
    HealthModule,
    NutritionAgentModule,
    NutritionTargetsModule,
    PlanCheckpointModule,
    ProtocolModule,
    RecoveryPlanAgentModule,
    SafetyAgentModule,
    SafetyModule,
    TrainingLoadAgentModule,
    TrainingPlanAgentModule,
    TrainingScheduleModule,
    UsageModule
  ],
  providers: [
    DailyPlanOrchestratorService,
    DailyPlanAgentExecutionService,
    DailyPlanFinalizationService,
    DailyPlanGenerationContextService,
    DailyPlanPersistenceService,
    DailyPlanSafetyOrchestratorService,
    DailyPlanTrainingLoadService
  ],
  exports: [DailyPlanOrchestratorService]
})
export class DailyPlanOrchestratorModule {}
