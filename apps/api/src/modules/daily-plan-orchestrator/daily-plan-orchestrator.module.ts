import { Module } from '@nestjs/common';

import { AiOperationLogsModule } from '../ai-operation-logs/ai-operation-logs.module';
import { RecoveryPlanAgentModule } from '../recovery-plan-agent/recovery-plan-agent.module';
import { SafetyAgentModule } from '../safety-agent/safety-agent.module';
import { SafetyModule } from '../safety/safety.module';
import { TrainingPlanAgentModule } from '../training-plan-agent/training-plan-agent.module';
import { DailyPlanOrchestratorService } from './daily-plan-orchestrator.service';
import { DailyPlanPersistenceService } from './daily-plan-persistence.service';
import { DailyPlanSafetyOrchestratorService } from './daily-plan-safety-orchestrator.service';

@Module({
  imports: [
    AiOperationLogsModule,
    RecoveryPlanAgentModule,
    SafetyAgentModule,
    SafetyModule,
    TrainingPlanAgentModule
  ],
  providers: [
    DailyPlanOrchestratorService,
    DailyPlanPersistenceService,
    DailyPlanSafetyOrchestratorService
  ],
  exports: [DailyPlanOrchestratorService]
})
export class DailyPlanOrchestratorModule {}
