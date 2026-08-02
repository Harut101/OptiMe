const {
  resolveSmokeConfig,
  runDeploymentSmoke
}: {
  resolveSmokeConfig: (environment: Record<string, string>) => {
    baseUrl: string;
    timeoutMs: number;
  };
  runDeploymentSmoke: (
    config: { baseUrl: string; timeoutMs: number },
    fetchImplementation: typeof fetch
  ) => Promise<Array<{ name: string; requestIdPresent: boolean }>>;
} = require('./deployment-smoke.cjs');

const REQUEST_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

describe('deployment smoke check', () => {
  it('normalizes a safe base URL and bounded timeout', () => {
    expect(
      resolveSmokeConfig({
        API_SMOKE_BASE_URL: 'https://api.optime.example/',
        API_SMOKE_TIMEOUT_MS: '5000'
      })
    ).toEqual({
      baseUrl: 'https://api.optime.example',
      timeoutMs: 5000
    });
  });

  it('rejects missing, credentialed, and ambiguous URLs', () => {
    expect(() => resolveSmokeConfig({})).toThrow(
      'API_SMOKE_BASE_URL is required'
    );
    expect(() =>
      resolveSmokeConfig({
        API_SMOKE_BASE_URL: 'https://user:secret@api.optime.example'
      })
    ).toThrow('without credentials');
    expect(() =>
      resolveSmokeConfig({
        API_SMOKE_BASE_URL: 'https://api.optime.example?token=secret'
      })
    ).toThrow('without credentials');
  });

  it('validates liveness, readiness, and server-owned request IDs', async () => {
    const responses = [
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-request-id': REQUEST_ID
        }
      }),
      new Response(
        JSON.stringify({ status: 'ready', checks: { database: 'up' } }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'x-request-id': REQUEST_ID
          }
        }
      )
    ];
    const fetchImplementation = jest.fn(async () => responses.shift()!);

    await expect(
      runDeploymentSmoke(
        { baseUrl: 'https://api.optime.example', timeoutMs: 5000 },
        fetchImplementation
      )
    ).resolves.toEqual([
      {
        name: 'liveness',
        latencyMs: expect.any(Number),
        requestIdPresent: true
      },
      {
        name: 'readiness',
        latencyMs: expect.any(Number),
        requestIdPresent: true
      }
    ]);
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it('fails safely when readiness is unavailable or request correlation is missing', async () => {
    const unavailable = jest.fn(
      async () =>
        new Response(JSON.stringify({ status: 'not_ready' }), {
          status: 503,
          headers: { 'x-request-id': REQUEST_ID }
        })
    );
    await expect(
      runDeploymentSmoke(
        { baseUrl: 'https://api.optime.example', timeoutMs: 5000 },
        unavailable
      )
    ).rejects.toThrow('unexpected HTTP status 503');

    const missingRequestId = jest.fn(
      async () =>
        new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
    );
    await expect(
      runDeploymentSmoke(
        { baseUrl: 'https://api.optime.example', timeoutMs: 5000 },
        missingRequestId
      )
    ).rejects.toThrow('valid X-Request-ID');
  });
});
