import { Module } from '@nestjs/common';

import { FoodCatalogService } from './food-catalog.service';
import { FoodCatalogCoverageService } from './food-catalog-coverage.service';
import { FoodCatalogSelectionService } from './food-catalog-selection.service';

@Module({
  providers: [FoodCatalogService, FoodCatalogSelectionService, FoodCatalogCoverageService],
  exports: [FoodCatalogService, FoodCatalogSelectionService, FoodCatalogCoverageService]
})
export class FoodCatalogModule {}
