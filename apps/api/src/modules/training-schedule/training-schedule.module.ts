import { Module } from '@nestjs/common';

import { TrainingScheduleController } from './training-schedule.controller';
import { TrainingScheduleService } from './training-schedule.service';

@Module({
  controllers: [TrainingScheduleController],
  providers: [TrainingScheduleService],
  exports: [TrainingScheduleService]
})
export class TrainingScheduleModule {}
