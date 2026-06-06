import { Module } from '@nestjs/common';

import { DailyPlanCheckInsController } from './daily-plan-check-ins.controller';
import { DailyPlanCheckInsService } from './daily-plan-check-ins.service';

@Module({
  controllers: [DailyPlanCheckInsController],
  providers: [DailyPlanCheckInsService],
  exports: [DailyPlanCheckInsService]
})
export class DailyPlanCheckInsModule {}
