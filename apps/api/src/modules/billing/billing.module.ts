import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BILLING_CONFIG } from './billing-config.token';
import { resolveBillingConfig } from './billing.config';
import { BillingEventsService } from './billing-events.service';

@Module({
  providers: [
    {
      provide: BILLING_CONFIG,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        resolveBillingConfig({
          BILLING_ENABLED: configService.get('BILLING_ENABLED'),
          BILLING_PROVIDER: configService.get('BILLING_PROVIDER'),
          BILLING_RECONCILIATION_TIMEOUT_MS: configService.get(
            'BILLING_RECONCILIATION_TIMEOUT_MS'
          ),
          REVENUECAT_SECRET_API_KEY: configService.get('REVENUECAT_SECRET_API_KEY'),
          REVENUECAT_WEBHOOK_AUTH_TOKEN: configService.get(
            'REVENUECAT_WEBHOOK_AUTH_TOKEN'
          )
        })
    },
    BillingEventsService
  ],
  exports: [BILLING_CONFIG, BillingEventsService]
})
export class BillingModule {}
