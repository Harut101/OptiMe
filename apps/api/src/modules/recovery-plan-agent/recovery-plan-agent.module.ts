import { Module } from '@nestjs/common';

import { RecoveryPlanAgentService } from './recovery-plan-agent.service';

@Module({
  providers: [RecoveryPlanAgentService],
  exports: [RecoveryPlanAgentService]
})
export class RecoveryPlanAgentModule {}
