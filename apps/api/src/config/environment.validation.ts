const PLACEHOLDER_SECRETS = new Set([
  'dev-only-secret',
  'development-auth-code-secret',
  'replace-with-a-long-random-secret',
  'replace-with-a-separate-long-random-secret'
]);

export function validateEnvironment(environment: Record<string, unknown>) {
  const nodeEnv = readString(environment.NODE_ENV) ?? 'development';

  if (nodeEnv !== 'production') {
    return environment;
  }

  requireValue(environment, 'DATABASE_URL');
  const jwtSecret = requireStrongSecret(environment, 'JWT_SECRET');
  const authCodeSecret = requireStrongSecret(environment, 'AUTH_CODE_SECRET');

  if (jwtSecret === authCodeSecret) {
    throw new Error('AUTH_CODE_SECRET must be different from JWT_SECRET in production.');
  }

  if (readString(environment.EMAIL_PROVIDER) !== 'resend') {
    throw new Error('EMAIL_PROVIDER=resend is required in production.');
  }

  requireValue(environment, 'RESEND_API_KEY');
  requireValue(environment, 'EMAIL_FROM');

  if (readString(environment.AUTH_DEV_CODE)) {
    throw new Error('AUTH_DEV_CODE must not be configured in production.');
  }

  const corsOrigins = parseCsv(environment.CORS_ALLOWED_ORIGINS);

  if (corsOrigins.length === 0 || corsOrigins.includes('*')) {
    throw new Error(
      'CORS_ALLOWED_ORIGINS must contain an explicit production origin allowlist.'
    );
  }

  parseInteger(environment.TRUST_PROXY_HOPS, 'TRUST_PROXY_HOPS', 0, 10);
  parseBoolean(environment.AUTH_RATE_LIMIT_ENABLED, 'AUTH_RATE_LIMIT_ENABLED');

  return environment;
}

export function parseCsv(value: unknown) {
  return (readString(value) ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseBoolean(value: unknown, name: string, fallback = true) {
  const normalized = readString(value);

  if (!normalized) {
    return fallback;
  }

  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw new Error(`${name} must be true or false.`);
}

export function parseInteger(
  value: unknown,
  name: string,
  minimum: number,
  maximum: number,
  fallback = minimum
) {
  const normalized = readString(value);

  if (!normalized) {
    return fallback;
  }

  const parsed = Number(normalized);

  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }

  return parsed;
}

function requireStrongSecret(environment: Record<string, unknown>, name: string) {
  const value = requireValue(environment, name);

  if (value.length < 32 || PLACEHOLDER_SECRETS.has(value)) {
    throw new Error(`${name} must be a non-placeholder secret of at least 32 characters.`);
  }

  return value;
}

function requireValue(environment: Record<string, unknown>, name: string) {
  const value = readString(environment[name]);

  if (!value) {
    throw new Error(`${name} is required in production.`);
  }

  return value;
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : undefined;
}
