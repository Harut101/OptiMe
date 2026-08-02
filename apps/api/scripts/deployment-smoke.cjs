const DEFAULT_TIMEOUT_MS = 10_000;
const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveSmokeConfig(environment = process.env) {
  const configuredBaseUrl = environment.API_SMOKE_BASE_URL?.trim();

  if (!configuredBaseUrl) {
    throw new Error(
      'API_SMOKE_BASE_URL is required for deployment smoke checks.'
    );
  }

  let url;
  try {
    url = new URL(configuredBaseUrl);
  } catch {
    throw new Error('API_SMOKE_BASE_URL must be a valid HTTP or HTTPS URL.');
  }

  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'API_SMOKE_BASE_URL must be an HTTP or HTTPS URL without credentials, query, or fragment.'
    );
  }

  const timeoutMs = parseTimeout(environment.API_SMOKE_TIMEOUT_MS);
  const baseUrl = url.toString().replace(/\/$/, '');

  return { baseUrl, timeoutMs };
}

async function runDeploymentSmoke(config, fetchImplementation = fetch) {
  const checks = [
    {
      name: 'liveness',
      path: '/v1/system/health/live',
      validate: (body) => body?.status === 'ok'
    },
    {
      name: 'readiness',
      path: '/v1/system/health/ready',
      validate: (body) =>
        body?.status === 'ready' && body?.checks?.database === 'up'
    }
  ];

  const results = [];
  for (const check of checks) {
    const startedAt = Date.now();
    const response = await fetchImplementation(
      `${config.baseUrl}${check.path}`,
      {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(config.timeoutMs)
      }
    );
    const requestId = response.headers.get('x-request-id');

    if (!response.ok) {
      throw new Error(
        `${check.name} check returned unexpected HTTP status ${response.status}.`
      );
    }
    if (!requestId || !REQUEST_ID_PATTERN.test(requestId)) {
      throw new Error(
        `${check.name} check did not return a valid X-Request-ID.`
      );
    }

    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error(`${check.name} check returned invalid JSON.`);
    }
    if (!check.validate(body)) {
      throw new Error(
        `${check.name} check returned an unexpected safe health contract.`
      );
    }

    results.push({
      name: check.name,
      latencyMs: Date.now() - startedAt,
      requestIdPresent: true
    });
  }

  return results;
}

function parseTimeout(value) {
  const normalized = value?.trim();
  if (!normalized) return DEFAULT_TIMEOUT_MS;

  const timeoutMs = Number(normalized);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 30_000) {
    throw new Error(
      'API_SMOKE_TIMEOUT_MS must be an integer between 1000 and 30000.'
    );
  }

  return timeoutMs;
}

async function main() {
  const config = resolveSmokeConfig();
  const results = await runDeploymentSmoke(config);

  for (const result of results) {
    process.stdout.write(
      `API deployment smoke passed; check=${result.name}; latencyMs=${result.latencyMs}; requestIdPresent=${result.requestIdPresent}\n`
    );
  }
}

if (require.main === module) {
  main().catch((error) => {
    const message =
      error instanceof Error ? error.message : 'Unknown smoke-check error.';
    process.stderr.write(`API deployment smoke failed safely: ${message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  resolveSmokeConfig,
  runDeploymentSmoke
};
