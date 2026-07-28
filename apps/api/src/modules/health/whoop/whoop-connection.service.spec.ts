import { ForbiddenException } from '@nestjs/common';
import { HealthConnectionStatus, HealthProvider } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { FeatureAccessService } from '../../entitlements/feature-access.service';
import { WhoopConnectionService } from './whoop-connection.service';
import type { WhoopCredentialStoreService } from './whoop-credential-store.service';
import type { WhoopOAuthClientService } from './whoop-oauth-client.service';
import type { WhoopOAuthService } from './whoop-oauth.service';
import { WhoopConfig } from './whoop.types';

const config: WhoopConfig = {
  enabled: true,
  clientId: 'client-id',
  clientSecret: 'client-secret',
  redirectUri: 'https://api.optime.test/v1/whoop/callback',
  tokenEncryptionKey: Buffer.alloc(32, 4),
  authUrl: 'https://api.prod.whoop.com/oauth/oauth2/auth',
  tokenUrl: 'https://api.prod.whoop.com/oauth/oauth2/token',
  apiBaseUrl: 'https://api.prod.whoop.com/developer',
  stateTtlSeconds: 600,
  requestTimeoutMs: 15_000,
  scopes: ['offline', 'read:recovery']
};

describe('WhoopConnectionService', () => {
  it('blocks authorization for a non-Pro user', async () => {
    const dependencies = createDependencies();
    dependencies.featureAccess.canUseWhoop.mockResolvedValue(false);
    const service = createService(dependencies);

    await expect(service.createAuthorization('user-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(dependencies.oauth.createAuthorizationUrl).not.toHaveBeenCalled();
  });

  it('persists a valid callback and marks WHOOP connected', async () => {
    const dependencies = createDependencies();
    dependencies.featureAccess.canUseWhoop.mockResolvedValue(true);
    dependencies.oauth.consumeAuthorizationState.mockResolvedValue({
      userId: 'user-1',
      redirectUri: config.redirectUri
    });
    dependencies.oauthClient.exchangeAuthorizationCode.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresInSeconds: 3600,
      scopes: config.scopes,
      tokenType: 'bearer'
    });
    dependencies.credentials.saveAndMarkConnected.mockResolvedValue(undefined);
    dependencies.credentials.exists.mockResolvedValue(true);
    dependencies.prisma.healthConnection.findUnique.mockResolvedValue({
      provider: HealthProvider.WHOOP,
      status: HealthConnectionStatus.CONNECTED,
      consentedAt: new Date('2026-07-28T12:00:00.000Z'),
      lastSyncAt: null,
      errorReason: null
    });
    const service = createService(dependencies);

    await expect(
      service.completeAuthorization({
        state: '12345678',
        code: 'authorization-code'
      })
    ).resolves.toMatchObject({
      provider: HealthProvider.WHOOP,
      status: 'CONNECTED',
      enabled: true,
      requiredPlan: 'PRO'
    });
    expect(dependencies.oauthClient.exchangeAuthorizationCode).toHaveBeenCalledWith(
      'authorization-code',
      config.redirectUri
    );
    expect(dependencies.credentials.saveAndMarkConnected).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        scopes: config.scopes
      })
    );
  });

  it('disconnects locally even when provider revocation fails', async () => {
    const dependencies = createDependencies();
    dependencies.credentials.get.mockResolvedValue({
      accessToken: 'access-token',
      scopes: config.scopes
    });
    dependencies.oauthClient.revokeAccess.mockRejectedValue(new Error('provider unavailable'));
    dependencies.credentials.deleteAndMarkDisconnected.mockResolvedValue(undefined);
    dependencies.credentials.exists.mockResolvedValue(false);
    dependencies.prisma.healthConnection.findUnique.mockResolvedValue({
      provider: HealthProvider.WHOOP,
      status: HealthConnectionStatus.DISCONNECTED,
      consentedAt: new Date('2026-07-28T12:00:00.000Z'),
      lastSyncAt: null,
      errorReason: null
    });
    const service = createService(dependencies);

    await expect(service.disconnect('user-1')).resolves.toMatchObject({
      status: 'NOT_CONNECTED',
      providerRevoked: false
    });
    expect(dependencies.credentials.deleteAndMarkDisconnected).toHaveBeenCalledWith('user-1');
  });
});

function createDependencies() {
  return {
    prisma: {
      healthConnection: {
        findUnique: jest.fn()
      }
    },
    featureAccess: {
      canUseWhoop: jest.fn()
    },
    oauth: {
      createAuthorizationUrl: jest.fn(),
      consumeAuthorizationState: jest.fn()
    },
    oauthClient: {
      exchangeAuthorizationCode: jest.fn(),
      revokeAccess: jest.fn()
    },
    credentials: {
      saveAndMarkConnected: jest.fn(),
      get: jest.fn(),
      exists: jest.fn(),
      deleteAndMarkDisconnected: jest.fn()
    }
  };
}

function createService(dependencies: ReturnType<typeof createDependencies>) {
  return new WhoopConnectionService(
    dependencies.prisma as unknown as PrismaService,
    dependencies.featureAccess as unknown as FeatureAccessService,
    dependencies.oauth as unknown as WhoopOAuthService,
    dependencies.oauthClient as unknown as WhoopOAuthClientService,
    dependencies.credentials as unknown as WhoopCredentialStoreService,
    config
  );
}
