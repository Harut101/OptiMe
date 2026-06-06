import { Module } from '@nestjs/common';

import { TrainingPreferencesController } from './training-preferences.controller';
import { TrainingPreferencesService } from './training-preferences.service';

@Module({
  controllers: [TrainingPreferencesController],
  providers: [TrainingPreferencesService],
  exports: [TrainingPreferencesService]
})
export class TrainingPreferencesModule {}
