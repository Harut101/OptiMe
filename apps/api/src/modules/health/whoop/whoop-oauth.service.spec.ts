import type { PrismaService } from '../../../prisma/prisma.service';
import { WhoopError } from './whoop.error';
import { WhoopOAuthStateService } from './whoop-oauth-state.service';
import { WhoopOAuthService } from './whoop-oauth.service';
import { WhoopConfig } from './whoop.types';

describe('WHOOP OAuth foundation', () => {
  const config: WhoopConfig = {
    enabled: true,
    clientId: 'client-id',
    clientSecret: 'client-secret',
    redirectUri: 'https://api.optime.test/v1/whoop/callback',
    tokenEncryptionKey: Buffer.alloc(32, 3),
    authUrl: 'https://api.prod.whoop.com/oauth/oauth2/auth',
    tokenUrl: 'https://api.prod.whoop.com/oauth/oauth2/token',
    apiBaseUrl: 'https://api.prod.whoop.com/developer',
    stateTtlSeconds: 600,
    scopes: ['offline', 'read:recovery', 'read:sleep']
  };

  it('builds a WHOOP authorization URL and stores only a state hash', async () => {
    const prisma = createPrismaMock();
    const states = new WhoopOAuthStateService(prisma.service, config);
    const oauth = new WhoopOAuthService(states, config);

    const result = await oauth.createAuthorizationUrl('user-1');
    const url = new URL(result.authorizationUrl);
    const state = url.searchParams.get('state');
    const stored = prisma.create.mock.calls[0][0].data;

    expect(url.origin + url.pathname).toBe(config.authUrl);
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('redirect_uri')).toBe(config.redirectUri);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe(
      'offline read:recovery read:sleep'
    );
    expect(state).toBeTruthy();
    expect(stored.userId).toBe('user-1');
    expect(stored.redirectUri).toBe(config.redirectUri);
    expect(stored.stateHash).not.toBe(state);
    expect(stored).not.toHaveProperty('state');
  });

  it('consumes a valid state only once', async () => {
    const prisma = createPrismaMock();
    const states = new WhoopOAuthStateService(prisma.service, config);
    const created = await states.create('user-1');
    const stored = prisma.create.mock.calls[0][0].data;

    prisma.findUnique.mockResolvedValue({
      id: 'state-id',
      userId: 'user-1',
      stateHash: stored.stateHash,
      redirectUri: config.redirectUri,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      createdAt: new Date()
    });
    prisma.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    await expect(states.consume(created.state)).resolves.toEqual({
      userId: 'user-1',
      redirectUri: config.redirectUri
    });
    await expect(states.consume(created.state)).rejects.toMatchObject({
      code: 'WHOOP_OAUTH_STATE_INVALID'
    });
  });

  it('rejects expired state before any callback can exchange tokens', async () => {
    const prisma = createPrismaMock();
    const states = new WhoopOAuthStateService(prisma.service, config);

    prisma.findUnique.mockResolvedValue({
      id: 'state-id',
      userId: 'user-1',
      stateHash: 'hash',
      redirectUri: config.redirectUri,
      expiresAt: new Date(Date.now() - 1),
      consumedAt: null,
      createdAt: new Date()
    });

    await expect(states.consume('expired-state')).rejects.toEqual(
      expect.objectContaining<Partial<WhoopError>>({
        code: 'WHOOP_OAUTH_STATE_INVALID'
      })
    );
    expect(prisma.updateMany).not.toHaveBeenCalled();
  });
});

function createPrismaMock() {
  const create = jest.fn();
  const findUnique = jest.fn();
  const updateMany = jest.fn();

  return {
    create,
    findUnique,
    updateMany,
    service: {
      whoopOAuthState: {
        create,
        findUnique,
        updateMany
      }
    } as unknown as PrismaService
  };
}
