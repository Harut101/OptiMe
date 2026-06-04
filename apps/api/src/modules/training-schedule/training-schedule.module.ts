import { Module } from '@nestjs/common';

import { SafetyModule } from '../safety/safety.module';
import { TrainingScheduleController } from './training-schedule.controller';
import { TrainingScheduleService } from './training-schedule.service';

@Module({
  imports: [SafetyModule],
  controllers: [TrainingScheduleController],
  providers: [TrainingScheduleService],
  exports: [TrainingScheduleService]
})
export class TrainingScheduleModule {}
