import { Module } from '@nestjs/common';

import { SafetyModule } from '../safety/safety.module';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';

@Module({
  imports: [SafetyModule],
  controllers: [GoalsController],
  providers: [GoalsService],
  exports: [GoalsService]
})
export class GoalsModule {}
