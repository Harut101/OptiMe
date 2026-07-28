import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { WHOOP_CONFIG } from './whoop.constants';
import { createWhoopConfig } from './whoop-config.factory';
import { WhoopCredentialStoreService } from './whoop-credential-store.service';
import { WhoopOAuthStateService } from './whoop-oauth-state.service';
import { WhoopOAuthService } from './whoop-oauth.service';
import { WhoopTokenEncryptionService } from './whoop-token-encryption.service';

@Module({
  providers: [
    {
      provide: WHOOP_CONFIG,
      inject: [ConfigService],
      useFactory: createWhoopConfig
    },
    WhoopTokenEncryptionService,
    WhoopCredentialStoreService,
    WhoopOAuthStateService,
    WhoopOAuthService
  ],
  exports: [
    WHOOP_CONFIG,
    WhoopTokenEncryptionService,
    WhoopCredentialStoreService,
    WhoopOAuthStateService,
    WhoopOAuthService
  ]
})
export class WhoopModule {}
