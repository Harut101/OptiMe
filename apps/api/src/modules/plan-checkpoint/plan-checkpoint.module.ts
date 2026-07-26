import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { SafetyModule } from '../safety/safety.module';
import { SafetyAgentModule } from '../safety-agent/safety-agent.module';
import { PlanCheckpointController } from './plan-checkpoint.controller';
import { PlanCheckpointMaterialChangeDetectorService } from './plan-checkpoint-material-change-detector.service';
import { PlanCheckpointProposalService } from './plan-checkpoint-proposal.service';
import { PlanCheckpointService } from './plan-checkpoint.service';

@Module({
  imports: [AiModule, SafetyModule, SafetyAgentModule],
  controllers: [PlanCheckpointController],
  providers: [
    PlanCheckpointMaterialChangeDetectorService,
    PlanCheckpointService,
    PlanCheckpointProposalService
  ],
  exports: [
    PlanCheckpointMaterialChangeDetectorService,
    PlanCheckpointService
  ]
})
export class PlanCheckpointModule {}
