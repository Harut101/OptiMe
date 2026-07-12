import { Module } from '@nestjs/common';

import { FoodCatalogService } from './food-catalog.service';

@Module({
  providers: [FoodCatalogService],
  exports: [FoodCatalogService]
})
export class FoodCatalogModule {}
