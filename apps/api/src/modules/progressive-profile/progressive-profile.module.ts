import { Module } from '@nestjs/common';

import { ProgressiveProfileController } from './progressive-profile.controller';
import { ProgressiveProfileService } from './progressive-profile.service';

@Module({
  controllers: [ProgressiveProfileController],
  providers: [ProgressiveProfileService],
  exports: [ProgressiveProfileService]
})
export class ProgressiveProfileModule {}
