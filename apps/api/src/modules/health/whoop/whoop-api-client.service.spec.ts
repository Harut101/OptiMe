import { WhoopApiClientService } from './whoop-api-client.service';
import { WhoopConfig, WhoopHttpClient } from './whoop.types';

describe('WhoopApiClientService', () => {
  const config: WhoopConfig = {
    enabled: true,
    apiBaseUrl: 'https://api.prod.whoop.com/developer',
    authUrl: 'https://example.test/auth',
    tokenUrl: 'https://example.test/token',
    stateTtlSeconds: 600,
    requestTimeoutMs: 15_000,
    scopes: []
  };

  it('reads and validates a WHOOP recovery collection without exposing the token', async () => {
    const fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        records: [
          {
            cycle_id: 42,
            created_at: '2026-07-28T08:00:00.000Z',
            score_state: 'SCORED',
            score: {
              user_calibrating: false,
              recovery_score: 78,
              resting_heart_rate: 52,
              hrv_rmssd_milli: 67
            }
          }
        ]
      })
    );
    const service = new WhoopApiClientService(config, { fetch } as WhoopHttpClient);

    await expect(
      service.getRecovery('access-token', {
        start: '2026-07-27T00:00:00.000Z',
        end: '2026-07-28T23:59:59.000Z'
      })
    ).resolves.toMatchObject({
      records: [{ cycle_id: 42 }]
    });

    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toContain('/v2/recovery?');
    expect(init.headers.Authorization).toBe('Bearer access-token');
  });

  it('maps 401 to a typed reauthorization error', async () => {
    const service = new WhoopApiClientService(config, {
      fetch: jest.fn().mockResolvedValue(new Response(null, { status: 401 }))
    } as WhoopHttpClient);

    await expect(
      service.getCycles('expired-token', {
        start: '2026-07-27T00:00:00.000Z',
        end: '2026-07-28T23:59:59.000Z'
      })
    ).rejects.toMatchObject({ code: 'WHOOP_REAUTH_REQUIRED' });
  });

  it('rejects malformed provider data', async () => {
    const service = new WhoopApiClientService(config, {
      fetch: jest.fn().mockResolvedValue(jsonResponse({ records: [{ score: 'invalid' }] }))
    } as WhoopHttpClient);

    await expect(
      service.getSleep('access-token', {
        start: '2026-07-27T00:00:00.000Z',
        end: '2026-07-28T23:59:59.000Z'
      })
    ).rejects.toMatchObject({ code: 'WHOOP_DATA_RESPONSE_INVALID' });
  });
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
