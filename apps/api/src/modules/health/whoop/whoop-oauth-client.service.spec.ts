import { WhoopOAuthClientService } from './whoop-oauth-client.service';
import { WhoopConfig, WhoopHttpClient } from './whoop.types';

describe('WhoopOAuthClientService', () => {
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
    scopes: ['offline', 'read:recovery', 'read:cycles', 'read:workout', 'read:sleep']
  };

  it('exchanges an authorization code using a form body', async () => {
    const fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        scope: config.scopes.join(' '),
        token_type: 'bearer'
      })
    );
    const service = createService(fetch);

    await expect(
      service.exchangeAuthorizationCode('authorization-code', config.redirectUri!)
    ).resolves.toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresInSeconds: 3600,
      scopes: config.scopes,
      tokenType: 'bearer'
    });

    const [url, init] = fetch.mock.calls[0];
    const body = new URLSearchParams(init.body);

    expect(url).toBe(config.tokenUrl);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('authorization-code');
    expect(body.get('client_id')).toBe('client-id');
    expect(body.get('client_secret')).toBe('client-secret');
    expect(body.get('redirect_uri')).toBe(config.redirectUri);
  });

  it('rejects a token response that omits required scopes', async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expires_in: 3600,
          scope: 'offline read:sleep',
          token_type: 'bearer'
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(
      createService(fetch).exchangeAuthorizationCode('authorization-code', config.redirectUri!)
    ).rejects.toMatchObject({
      code: 'WHOOP_REQUIRED_SCOPES_MISSING'
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('rejects malformed token responses without exposing response content', async () => {
    const fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        access_token: 'access-token',
        expires_in: 3600,
        scope: config.scopes.join(' '),
        token_type: 'bearer'
      })
    );

    await expect(
      createService(fetch).exchangeAuthorizationCode('authorization-code', config.redirectUri!)
    ).rejects.toMatchObject({
      code: 'WHOOP_TOKEN_RESPONSE_INVALID',
      message: 'WHOOP returned an invalid token response.'
    });
  });

  it('rotates access and refresh tokens using the documented refresh form', async () => {
    const fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        access_token: 'rotated-access-token',
        refresh_token: 'rotated-refresh-token',
        expires_in: 3600,
        scope: config.scopes.join(' '),
        token_type: 'bearer'
      })
    );
    const service = createService(fetch);

    await expect(service.refreshAccessToken('old-refresh-token')).resolves.toMatchObject({
      accessToken: 'rotated-access-token',
      refreshToken: 'rotated-refresh-token'
    });

    const [url, init] = fetch.mock.calls[0];
    const body = new URLSearchParams(init.body);
    expect(url).toBe(config.tokenUrl);
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('old-refresh-token');
    expect(body.get('scope')).toBe('offline');
  });

  it('revokes access with a bearer token and accepts an already invalid token', async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    const service = createService(fetch);

    await expect(service.revokeAccess('access-token')).resolves.toBe(true);
    await expect(service.revokeAccess('expired-token')).resolves.toBe(true);

    expect(fetch.mock.calls[0][0]).toBe('https://api.prod.whoop.com/developer/v2/user/access');
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer access-token');
  });

  function createService(fetch: jest.Mock) {
    return new WhoopOAuthClientService(config, {
      fetch
    } as WhoopHttpClient);
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
