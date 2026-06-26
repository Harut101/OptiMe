import { Module } from '@nestjs/common';

import { HealthModule } from '../health/health.module';
import { TrainingScheduleModule } from '../training-schedule/training-schedule.module';
import { NutritionTargetInputResolver } from './nutrition-target-input.resolver';
import { NutritionTargetsController } from './nutrition-targets.controller';
import { NutritionTargetsService } from './nutrition-targets.service';

@Module({
  imports: [HealthModule, TrainingScheduleModule],
  controllers: [NutritionTargetsController],
  providers: [NutritionTargetInputResolver, NutritionTargetsService],
  exports: [NutritionTargetsService]
})
export class NutritionTargetsModule {}
