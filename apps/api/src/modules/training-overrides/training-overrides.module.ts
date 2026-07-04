import { Module } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { TrainingScheduleModule } from '../training-schedule/training-schedule.module';
import { TrainingOverridesController } from './training-overrides.controller';
import { TrainingOverridesService } from './training-overrides.service';

@Module({
  imports: [TrainingScheduleModule],
  controllers: [TrainingOverridesController],
  providers: [TrainingOverridesService, PrismaService],
  exports: [TrainingOverridesService]
})
export class TrainingOverridesModule {}
