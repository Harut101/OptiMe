import { Module } from '@nestjs/common';

import { PlanCheckpointController } from './plan-checkpoint.controller';
import { PlanCheckpointMaterialChangeDetectorService } from './plan-checkpoint-material-change-detector.service';
import { PlanCheckpointService } from './plan-checkpoint.service';

@Module({
  controllers: [PlanCheckpointController],
  providers: [
    PlanCheckpointMaterialChangeDetectorService,
    PlanCheckpointService
  ],
  exports: [
    PlanCheckpointMaterialChangeDetectorService,
    PlanCheckpointService
  ]
})
export class PlanCheckpointModule {}
