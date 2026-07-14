import { Module } from '@nestjs/common';

import { FoodCatalogService } from './food-catalog.service';
import { FoodCatalogSelectionService } from './food-catalog-selection.service';

@Module({
  providers: [FoodCatalogService, FoodCatalogSelectionService],
  exports: [FoodCatalogService, FoodCatalogSelectionService]
})
export class FoodCatalogModule {}
