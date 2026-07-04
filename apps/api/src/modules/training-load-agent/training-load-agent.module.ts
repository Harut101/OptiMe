import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { TrainingLoadAgentService } from './training-load-agent.service';

@Module({
  imports: [AiModule],
  providers: [TrainingLoadAgentService],
  exports: [TrainingLoadAgentService]
})
export class TrainingLoadAgentModule {}
