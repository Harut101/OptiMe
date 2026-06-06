import { Module } from '@nestjs/common';

import { EntitlementsModule } from '../entitlements/entitlements.module';
import { UsageController } from './usage.controller';
import { UsageGuardService } from './usage-guard.service';
import { UsageLedgerService } from './usage-ledger.service';

@Module({
  imports: [EntitlementsModule],
  controllers: [UsageController],
  providers: [UsageLedgerService, UsageGuardService],
  exports: [UsageLedgerService, UsageGuardService]
})
export class UsageModule {}
