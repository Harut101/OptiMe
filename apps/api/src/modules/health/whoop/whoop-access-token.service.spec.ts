import { HealthConnectionStatus } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import { WhoopAccessTokenService } from './whoop-access-token.service';
import type { WhoopCredentialStoreService } from './whoop-credential-store.service';
import type { WhoopOAuthClientService } from './whoop-oauth-client.service';

describe('WhoopAccessTokenService', () => {
  it('coalesces concurrent refreshes and persists the rotated token pair once', async () => {
    const prisma = {
      healthConnection: {
        upsert: jest.fn().mockResolvedValue(undefined)
      }
    };
    const credentials = {
      get: jest.fn().mockResolvedValue({
        accessToken: 'expired-access',
        refreshToken: 'old-refresh',
        accessTokenExpiresAt: new Date(Date.now() - 60_000),
        scopes: ['offline']
      }),
      rotate: jest.fn().mockResolvedValue(undefined)
    };
    const oauthClient = {
      refreshAccessToken: jest.fn().mockResolvedValue({
        accessToken: 'rotated-access',
        refreshToken: 'rotated-refresh',
        expiresInSeconds: 3600,
        scopes: ['offline'],
        tokenType: 'bearer'
      })
    };
    const service = new WhoopAccessTokenService(
      prisma as unknown as PrismaService,
      credentials as unknown as WhoopCredentialStoreService,
      oauthClient as unknown as WhoopOAuthClientService
    );

    await expect(
      Promise.all([
        service.getAccessToken('user-1'),
        service.getAccessToken('user-1')
      ])
    ).resolves.toEqual([
      { accessToken: 'rotated-access', refreshed: true },
      { accessToken: 'rotated-access', refreshed: true }
    ]);
    expect(oauthClient.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(credentials.rotate).toHaveBeenCalledTimes(1);
    expect(credentials.rotate).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        accessToken: 'rotated-access',
        refreshToken: 'rotated-refresh'
      })
    );
    expect(prisma.healthConnection.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: HealthConnectionStatus.CONNECTED,
          errorReason: null
        })
      })
    );
  });
});
