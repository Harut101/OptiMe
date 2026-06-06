import { Module } from '@nestjs/common';

import { ProgressiveProfileModule } from '../progressive-profile/progressive-profile.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [ProgressiveProfileModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService]
})
export class OnboardingModule {}
