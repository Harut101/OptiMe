import { Module } from '@nestjs/common';

import { FoodCatalogModule } from '../food-catalog/food-catalog.module';
import { FoodAvailabilityController } from './food-availability.controller';
import { FoodAvailabilityService } from './food-availability.service';

@Module({
  imports: [FoodCatalogModule],
  controllers: [FoodAvailabilityController],
  providers: [FoodAvailabilityService],
  exports: [FoodAvailabilityService]
})
export class FoodAvailabilityModule {}
