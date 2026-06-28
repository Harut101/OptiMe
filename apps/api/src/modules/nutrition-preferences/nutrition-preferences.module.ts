import { Module } from '@nestjs/common';

import { SafetyModule } from '../safety/safety.module';
import {
  FoodPreferencesController,
  NutritionPreferencesController
} from './nutrition-preferences.controller';
import { NutritionPreferencesService } from './nutrition-preferences.service';

@Module({
  imports: [SafetyModule],
  controllers: [NutritionPreferencesController, FoodPreferencesController],
  providers: [NutritionPreferencesService],
  exports: [NutritionPreferencesService]
})
export class NutritionPreferencesModule {}
