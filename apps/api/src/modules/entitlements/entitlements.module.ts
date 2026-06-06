import { Module } from '@nestjs/common';

import { EntitlementsController } from './entitlements.controller';
import { EntitlementsService } from './entitlements.service';
import { FeatureAccessService } from './feature-access.service';

@Module({
  controllers: [EntitlementsController],
  providers: [EntitlementsService, FeatureAccessService],
  exports: [EntitlementsService, FeatureAccessService]
})
export class EntitlementsModule {}
