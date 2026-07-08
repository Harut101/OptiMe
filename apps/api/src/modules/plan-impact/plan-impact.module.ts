import { Module } from '@nestjs/common';

import { PlanImpactController } from './plan-impact.controller';
import { PlanImpactService } from './plan-impact.service';

@Module({
  controllers: [PlanImpactController],
  providers: [PlanImpactService],
  exports: [PlanImpactService]
})
export class PlanImpactModule {}
