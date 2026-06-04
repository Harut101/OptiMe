import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { SafetyAgentModule } from '../safety-agent/safety-agent.module';
import { SafetyModule } from '../safety/safety.module';
import { DailyPlansController } from './daily-plans.controller';
import { DailyPlansService } from './daily-plans.service';

@Module({
  imports: [AiModule, SafetyModule, SafetyAgentModule],
  controllers: [DailyPlansController],
  providers: [DailyPlansService],
  exports: [DailyPlansService]
})
export class DailyPlansModule {}
