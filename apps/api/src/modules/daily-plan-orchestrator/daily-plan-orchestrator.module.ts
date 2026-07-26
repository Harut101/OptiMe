import { Module } from '@nestjs/common';

import { RecoveryPlanAgentModule } from '../recovery-plan-agent/recovery-plan-agent.module';
import { TrainingPlanAgentModule } from '../training-plan-agent/training-plan-agent.module';
import { DailyPlanOrchestratorService } from './daily-plan-orchestrator.service';

@Module({
  imports: [RecoveryPlanAgentModule, TrainingPlanAgentModule],
  providers: [DailyPlanOrchestratorService],
  exports: [DailyPlanOrchestratorService]
})
export class DailyPlanOrchestratorModule {}
