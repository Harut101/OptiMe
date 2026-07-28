import {
  SubscriptionEnvironment,
  SubscriptionPlan,
  SubscriptionProvider,
  SubscriptionStatus
} from '@prisma/client';
import request from 'supertest';

import { WHOOP_CONFIG, WHOOP_HTTP_CLIENT } from '../src/modules/health/whoop/whoop.constants';
import { WhoopConfig, WhoopHttpClient } from '../src/modules/health/whoop/whoop.types';
import { authHeader, registerTestUser } from './helpers/auth';
import { cleanupDatabase } from './helpers/cleanup';
import { createTestApp, TestApp } from './helpers/test-app';

describe('WHOOP OAuth (e2e)', () => {
  let ctx: TestApp;
  const fetch = jest.fn();
  const config: WhoopConfig = {
    enabled: true,
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'https://api.optime.test/v1/whoop/callback',
    tokenEncryptionKey: Buffer.alloc(32, 6),
    authUrl: 'https://api.prod.whoop.com/oauth/oauth2/auth',
    tokenUrl: 'https://api.prod.whoop.com/oauth/oauth2/token',
    apiBaseUrl: 'https://api.prod.whoop.com/developer',
    stateTtlSeconds: 600,
    requestTimeoutMs: 15_000,
    scopes: ['offline', 'read:recovery', 'read:cycles', 'read:workout', 'read:sleep']
  };

  beforeAll(async () => {
    ctx = await createTestApp({
      providerOverrides: [
        { token: WHOOP_CONFIG, value: config },
        {
          token: WHOOP_HTTP_CLIENT,
          value: { fetch } as WhoopHttpClient
        }
      ]
    });
  });

  beforeEach(async () => {
    fetch.mockReset();
    await cleanupDatabase(ctx.prisma);
  });

  afterAll(async () => {
    await cleanupDatabase(ctx.prisma);
    await ctx.app.close();
  });

  it('keeps status authenticated but readable without Pro', async () => {
    const user = await registerTestUser(ctx.app);

    await request(ctx.app.getHttpServer()).get('/v1/whoop/status').expect(401);

    const response = await request(ctx.app.getHttpServer())
      .get('/v1/whoop/status')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(response.body).toEqual({
      provider: 'WHOOP',
      status: 'NOT_CONNECTED',
      enabled: true,
      requiredPlan: 'PRO',
      connectedAt: null,
      lastSyncAt: null,
      errorCode: null
    });
  });

  it('blocks connect for Free and does not create OAuth state', async () => {
    const user = await registerTestUser(ctx.app);

    const response = await request(ctx.app.getHttpServer())
      .post('/v1/whoop/connect')
      .set(authHeader(user.accessToken))
      .expect(403);

    expect(response.body).toMatchObject({
      code: 'WHOOP_PRO_REQUIRED'
    });
    await expect(ctx.prisma.whoopOAuthState.count()).resolves.toBe(0);
  });

  it('consumes state when WHOOP authorization is denied', async () => {
    const user = await registerTestUser(ctx.app);
    await createProSubscription(user.user.id);
    const connect = await request(ctx.app.getHttpServer())
      .post('/v1/whoop/connect')
      .set(authHeader(user.accessToken))
      .expect(201);
    const state = new URL(connect.body.authorizationUrl).searchParams.get('state');

    await request(ctx.app.getHttpServer())
      .get('/v1/whoop/callback')
      .query({ error: 'access_denied', state })
      .expect(400)
      .expect(({ body }) => {
        expect(body.code).toBe('WHOOP_AUTHORIZATION_DENIED');
      });

    await request(ctx.app.getHttpServer())
      .get('/v1/whoop/callback')
      .query({ code: 'authorization-code', state })
      .expect(400)
      .expect(({ body }) => {
        expect(body.code).toBe('WHOOP_OAUTH_STATE_INVALID');
      });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('completes Pro OAuth, stores only encrypted tokens, and disconnects', async () => {
    const user = await registerTestUser(ctx.app);
    await createProSubscription(user.user.id);
    fetch
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: 'whoop-access-secret',
          refresh_token: 'whoop-refresh-secret',
          expires_in: 3600,
          scope: config.scopes.join(' '),
          token_type: 'bearer'
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const connect = await request(ctx.app.getHttpServer())
      .post('/v1/whoop/connect')
      .set(authHeader(user.accessToken))
      .expect(201);
    const authorizationUrl = new URL(connect.body.authorizationUrl);
    const state = authorizationUrl.searchParams.get('state');

    expect(state).toHaveLength(8);
    expect(authorizationUrl.searchParams.get('scope')).toBe(config.scopes.join(' '));

    const storedState = await ctx.prisma.whoopOAuthState.findFirstOrThrow({
      where: { userId: user.user.id }
    });
    expect(storedState.stateHash).not.toBe(state);

    const callback = await request(ctx.app.getHttpServer())
      .get('/v1/whoop/callback')
      .query({ code: 'authorization-code', state })
      .expect(200);

    expect(callback.body).toMatchObject({
      provider: 'WHOOP',
      status: 'CONNECTED',
      enabled: true,
      requiredPlan: 'PRO'
    });
    expect(JSON.stringify(callback.body)).not.toContain('whoop-access-secret');
    expect(JSON.stringify(callback.body)).not.toContain('whoop-refresh-secret');

    const credential = await ctx.prisma.whoopOAuthCredential.findUniqueOrThrow({
      where: { userId: user.user.id }
    });
    expect(credential.accessTokenCiphertext).not.toContain('whoop-access-secret');
    expect(credential.refreshTokenCiphertext).not.toContain('whoop-refresh-secret');

    await request(ctx.app.getHttpServer())
      .get('/v1/whoop/callback')
      .query({ code: 'authorization-code', state })
      .expect(400)
      .expect(({ body }) => {
        expect(body.code).toBe('WHOOP_OAUTH_STATE_INVALID');
      });

    await ctx.prisma.subscription.deleteMany({
      where: { userId: user.user.id }
    });

    const disconnected = await request(ctx.app.getHttpServer())
      .post('/v1/whoop/disconnect')
      .set(authHeader(user.accessToken))
      .expect(201);

    expect(disconnected.body).toMatchObject({
      provider: 'WHOOP',
      status: 'NOT_CONNECTED',
      providerRevoked: true
    });
    await expect(
      ctx.prisma.whoopOAuthCredential.count({
        where: { userId: user.user.id }
      })
    ).resolves.toBe(0);
    expect(fetch.mock.calls[1][0]).toBe('https://api.prod.whoop.com/developer/v2/user/access');
  });

  async function createProSubscription(userId: string) {
    await ctx.prisma.subscription.create({
      data: {
        userId,
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.ACTIVE,
        provider: SubscriptionProvider.DEV,
        environment: SubscriptionEnvironment.SANDBOX,
        startsAt: new Date(Date.now() - 60_000)
      }
    });
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
