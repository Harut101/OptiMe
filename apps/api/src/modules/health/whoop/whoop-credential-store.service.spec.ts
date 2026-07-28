import type { PrismaService } from '../../../prisma/prisma.service';
import { WhoopCredentialStoreService } from './whoop-credential-store.service';
import { WhoopTokenEncryptionService } from './whoop-token-encryption.service';
import { WhoopConfig } from './whoop.types';

describe('WhoopCredentialStoreService', () => {
  const config: WhoopConfig = {
    enabled: true,
    tokenEncryptionKey: Buffer.alloc(32, 5),
    authUrl: 'https://example.test/auth',
    tokenUrl: 'https://example.test/token',
    apiBaseUrl: 'https://example.test/api',
    stateTtlSeconds: 600,
    requestTimeoutMs: 15_000,
    scopes: []
  };

  it('stores encrypted credentials and returns decrypted values internally', async () => {
    const upsert = jest.fn().mockResolvedValue(undefined);
    const findUnique = jest.fn();
    const encryption = new WhoopTokenEncryptionService(config);
    const service = new WhoopCredentialStoreService(
      {
        whoopOAuthCredential: {
          upsert,
          findUnique,
          deleteMany: jest.fn()
        }
      } as unknown as PrismaService,
      encryption
    );
    const expiresAt = new Date('2026-08-01T00:00:00.000Z');

    await service.save('user-1', {
      accessToken: 'access-secret',
      refreshToken: 'refresh-secret',
      accessTokenExpiresAt: expiresAt,
      scopes: ['offline', 'read:recovery'],
      externalUserId: 'whoop-user'
    });

    const create = upsert.mock.calls[0][0].create;
    expect(create.accessTokenCiphertext).not.toContain('access-secret');
    expect(create.refreshTokenCiphertext).not.toContain('refresh-secret');
    expect(JSON.stringify(create)).not.toContain('access-secret');
    expect(JSON.stringify(create)).not.toContain('refresh-secret');

    findUnique.mockResolvedValue({
      ...create,
      id: 'credential-id',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await expect(service.get('user-1')).resolves.toEqual({
      accessToken: 'access-secret',
      refreshToken: 'refresh-secret',
      accessTokenExpiresAt: expiresAt,
      scopes: ['offline', 'read:recovery'],
      externalUserId: 'whoop-user'
    });
  });
});
