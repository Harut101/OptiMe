import { Module } from '@nestjs/common';

import { NutritionPreferencesController } from './nutrition-preferences.controller';
import { NutritionPreferencesService } from './nutrition-preferences.service';

@Module({
  controllers: [NutritionPreferencesController],
  providers: [NutritionPreferencesService],
  exports: [NutritionPreferencesService]
})
export class NutritionPreferencesModule {}
