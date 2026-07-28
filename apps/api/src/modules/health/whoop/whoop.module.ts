import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EntitlementsModule } from '../../entitlements/entitlements.module';
import { WHOOP_CONFIG, WHOOP_HTTP_CLIENT } from './whoop.constants';
import { createWhoopConfig } from './whoop-config.factory';
import { WhoopConnectionService } from './whoop-connection.service';
import { WhoopCredentialStoreService } from './whoop-credential-store.service';
import { WhoopAccessTokenService } from './whoop-access-token.service';
import { WhoopApiClientService } from './whoop-api-client.service';
import { WhoopOAuthClientService } from './whoop-oauth-client.service';
import { WhoopOAuthStateService } from './whoop-oauth-state.service';
import { WhoopOAuthService } from './whoop-oauth.service';
import { WhoopTokenEncryptionService } from './whoop-token-encryption.service';
import { WhoopController } from './whoop.controller';
import { WhoopSyncService } from './whoop-sync.service';

@Module({
  imports: [EntitlementsModule],
  controllers: [WhoopController],
  providers: [
    {
      provide: WHOOP_CONFIG,
      inject: [ConfigService],
      useFactory: createWhoopConfig
    },
    {
      provide: WHOOP_HTTP_CLIENT,
      useValue: {
        fetch: (input: string | URL, init?: RequestInit) => fetch(input, init)
      }
    },
    WhoopTokenEncryptionService,
    WhoopCredentialStoreService,
    WhoopOAuthStateService,
    WhoopOAuthService,
    WhoopOAuthClientService,
    WhoopConnectionService,
    WhoopAccessTokenService,
    WhoopApiClientService,
    WhoopSyncService
  ],
  exports: [
    WHOOP_CONFIG,
    WhoopTokenEncryptionService,
    WhoopCredentialStoreService,
    WhoopOAuthStateService,
    WhoopOAuthService,
    WhoopOAuthClientService,
    WhoopConnectionService,
    WhoopAccessTokenService,
    WhoopApiClientService,
    WhoopSyncService
  ]
})
export class WhoopModule {}
