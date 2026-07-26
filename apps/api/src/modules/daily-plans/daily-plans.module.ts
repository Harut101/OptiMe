import { Module } from '@nestjs/common';

import { DailyPlanOrchestratorModule } from '../daily-plan-orchestrator/daily-plan-orchestrator.module';
import { DailyPlansController } from './daily-plans.controller';
import { DailyPlansService } from './daily-plans.service';

@Module({
  imports: [DailyPlanOrchestratorModule],
  controllers: [DailyPlansController],
  providers: [DailyPlansService],
  exports: [DailyPlansService]
})
export class DailyPlansModule {}
