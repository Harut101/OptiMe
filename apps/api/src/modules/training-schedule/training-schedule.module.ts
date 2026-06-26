import { Module } from '@nestjs/common';

import { SafetyModule } from '../safety/safety.module';
import { TrainingScheduleController } from './training-schedule.controller';
import { TrainingScheduleResolverService } from './training-schedule-resolver.service';
import { TrainingScheduleService } from './training-schedule.service';

@Module({
  imports: [SafetyModule],
  controllers: [TrainingScheduleController],
  providers: [TrainingScheduleService, TrainingScheduleResolverService],
  exports: [TrainingScheduleService, TrainingScheduleResolverService]
})
export class TrainingScheduleModule {}
