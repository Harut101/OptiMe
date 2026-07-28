import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { HealthConnectionStatus, HealthProvider } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { FeatureAccessService } from '../../entitlements/feature-access.service';
import { WHOOP_CONFIG } from './whoop.constants';
import { WhoopCredentialStoreService } from './whoop-credential-store.service';
import { WhoopError } from './whoop.error';
import { WhoopOAuthClientService } from './whoop-oauth-client.service';
import { WhoopOAuthService } from './whoop-oauth.service';
import { WhoopAuthorizationCallback, WhoopConfig } from './whoop.types';

@Injectable()
export class WhoopConnectionService {
  private readonly logger = new Logger(WhoopConnectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly featureAccess: FeatureAccessService,
    private readonly oauth: WhoopOAuthService,
    private readonly oauthClient: WhoopOAuthClientService,
    private readonly credentials: WhoopCredentialStoreService,
    @Inject(WHOOP_CONFIG) private readonly config: WhoopConfig
  ) {}

  async createAuthorization(userId: string) {
    await this.assertPro(userId);
    return this.oauth.createAuthorizationUrl(userId);
  }

  async completeAuthorization(callback: WhoopAuthorizationCallback) {
    const state = await this.oauth.consumeAuthorizationState(callback.state);
    await this.assertPro(state.userId);

    if (callback.error || !callback.code) {
      this.logger.warn('WHOOP authorization was denied or canceled');
      throw new WhoopError(
        'WHOOP_AUTHORIZATION_DENIED',
        'WHOOP authorization was canceled or denied.'
      );
    }

    const token = await this.oauthClient.exchangeAuthorizationCode(
      callback.code,
      state.redirectUri
    );

    try {
      await this.credentials.saveAndMarkConnected(state.userId, {
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        accessTokenExpiresAt: new Date(Date.now() + token.expiresInSeconds * 1000),
        scopes: token.scopes
      });
    } catch {
      try {
        await this.oauthClient.revokeAccess(token.accessToken);
      } catch {
        this.logger.warn('WHOOP credential persistence failed; provider revocation also failed');
      }

      throw new WhoopError(
        'WHOOP_CONNECTION_PERSISTENCE_FAILED',
        'WHOOP connection could not be saved.'
      );
    }

    this.logger.log('WHOOP connection established');
    return this.getStatus(state.userId);
  }

  async getStatus(userId: string) {
    const [connection, hasCredential] = await Promise.all([
      this.prisma.healthConnection.findUnique({
        where: {
          userId_provider: {
            userId,
            provider: HealthProvider.WHOOP
          }
        }
      }),
      this.credentials.exists(userId)
    ]);
    const persistedStatus = connection?.status ?? HealthConnectionStatus.DISCONNECTED;
    const status =
      persistedStatus === HealthConnectionStatus.CONNECTED && !hasCredential
        ? 'NEEDS_REAUTH'
        : this.toPublicStatus(persistedStatus);

    return {
      provider: HealthProvider.WHOOP,
      status,
      enabled: this.config.enabled,
      requiredPlan: 'PRO' as const,
      connectedAt: connection?.consentedAt?.toISOString() ?? null,
      lastSyncAt: connection?.lastSyncAt?.toISOString() ?? null,
      errorCode: connection?.errorReason ?? null
    };
  }

  async disconnect(userId: string) {
    let providerRevoked = false;

    try {
      const credential = await this.credentials.get(userId);

      if (credential) {
        providerRevoked = await this.oauthClient.revokeAccess(credential.accessToken);
      }
    } catch (error) {
      const reason = error instanceof WhoopError ? error.code : 'unknown_error';
      this.logger.warn(`WHOOP provider revocation skipped or failed; reason=${reason}`);
    }

    await this.credentials.deleteAndMarkDisconnected(userId);
    this.logger.log(`WHOOP connection disconnected; providerRevoked=${providerRevoked}`);

    return {
      ...(await this.getStatus(userId)),
      providerRevoked
    };
  }

  private async assertPro(userId: string) {
    if (!(await this.featureAccess.canUseWhoop(userId))) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'WHOOP_PRO_REQUIRED',
        message: 'WHOOP integration requires a Pro plan.'
      });
    }
  }

  private toPublicStatus(status: HealthConnectionStatus) {
    if (status === HealthConnectionStatus.CONNECTED) {
      return 'CONNECTED' as const;
    }

    if (
      status === HealthConnectionStatus.NEEDS_REAUTH ||
      status === HealthConnectionStatus.PERMISSION_DENIED
    ) {
      return 'NEEDS_REAUTH' as const;
    }

    if (status === HealthConnectionStatus.ERROR) {
      return 'ERROR' as const;
    }

    if (status === HealthConnectionStatus.DISABLED) {
      return 'DISABLED' as const;
    }

    return 'NOT_CONNECTED' as const;
  }
}
