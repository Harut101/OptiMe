import { Module } from '@nestjs/common';

import { TrainingPreferencesModule } from '../training-preferences/training-preferences.module';
import { ProgressiveProfileController } from './progressive-profile.controller';
import { ProgressiveProfileService } from './progressive-profile.service';

@Module({
  imports: [TrainingPreferencesModule],
  controllers: [ProgressiveProfileController],
  providers: [ProgressiveProfileService],
  exports: [ProgressiveProfileService]
})
export class ProgressiveProfileModule {}
