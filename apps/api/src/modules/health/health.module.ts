import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { TrainingLoadContextResolver } from './training-load-context.resolver';
import { WearablePlanningContextResolver } from './wearable-planning-context.resolver';

@Module({
  controllers: [HealthController],
  providers: [HealthService, WearablePlanningContextResolver, TrainingLoadContextResolver],
  exports: [HealthService, WearablePlanningContextResolver, TrainingLoadContextResolver]
})
export class HealthModule {}
