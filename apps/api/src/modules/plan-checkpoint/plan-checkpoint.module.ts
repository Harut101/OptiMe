import { Module } from '@nestjs/common';

import { PlanCheckpointMaterialChangeDetectorService } from './plan-checkpoint-material-change-detector.service';

@Module({
  providers: [PlanCheckpointMaterialChangeDetectorService],
  exports: [PlanCheckpointMaterialChangeDetectorService]
})
export class PlanCheckpointModule {}
