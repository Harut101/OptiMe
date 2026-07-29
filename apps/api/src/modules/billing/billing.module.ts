import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BILLING_CONFIG } from './billing-config.token';
import { BILLING_PROVIDER } from './billing-provider.token';
import { BillingController } from './billing.controller';
import { resolveBillingConfig } from './billing.config';
import { BillingEventsService } from './billing-events.service';
import { BillingReconciliationService } from './billing-reconciliation.service';
import { RevenueCatBillingProviderService } from './revenuecat-billing-provider.service';

@Module({
  controllers: [BillingController],
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
          REVENUECAT_API_BASE_URL: configService.get('REVENUECAT_API_BASE_URL'),
          REVENUECAT_SECRET_API_KEY: configService.get('REVENUECAT_SECRET_API_KEY'),
          REVENUECAT_WEBHOOK_AUTH_TOKEN: configService.get(
            'REVENUECAT_WEBHOOK_AUTH_TOKEN'
          ),
          REVENUECAT_WEBHOOK_SIGNING_SECRET: configService.get(
            'REVENUECAT_WEBHOOK_SIGNING_SECRET'
          )
        })
    },
    RevenueCatBillingProviderService,
    {
      provide: BILLING_PROVIDER,
      useExisting: RevenueCatBillingProviderService
    },
    BillingEventsService,
    BillingReconciliationService
  ],
  exports: [
    BILLING_CONFIG,
    BILLING_PROVIDER,
    BillingEventsService,
    BillingReconciliationService
  ]
})
export class BillingModule {}
