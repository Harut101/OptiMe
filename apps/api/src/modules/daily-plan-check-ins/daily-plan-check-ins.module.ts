import { Module } from '@nestjs/common';

import { DailyPlanCheckInsController } from './daily-plan-check-ins.controller';
import { DailyPlanCheckInSummariesController } from './daily-plan-check-in-summaries.controller';
import { DailyPlanCheckInsService } from './daily-plan-check-ins.service';

@Module({
  controllers: [DailyPlanCheckInsController, DailyPlanCheckInSummariesController],
  providers: [DailyPlanCheckInsService],
  exports: [DailyPlanCheckInsService]
})
export class DailyPlanCheckInsModule {}
