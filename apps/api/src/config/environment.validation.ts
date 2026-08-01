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
  requireProductionHttpsUrl(environment, 'EXERCISE_MEDIA_PUBLIC_BASE_URL');
  const jwtSecret = requireStrongSecret(environment, 'JWT_SECRET');
  const authCodeSecret = requireStrongSecret(environment, 'AUTH_CODE_SECRET');

  if (jwtSecret === authCodeSecret) {
    throw new Error('AUTH_CODE_SECRET must be different from JWT_SECRET in production.');
  }

  if (readString(environment.EMAIL_PROVIDER) !== 'resend') {
    throw new Error('EMAIL_PROVIDER=resend is required in production.');
  }

  const resendApiKey = requireValue(environment, 'RESEND_API_KEY');

  if (!resendApiKey.startsWith('re_') || resendApiKey.length < 16) {
    throw new Error('RESEND_API_KEY must be a non-placeholder Resend API key.');
  }

  requireMailbox(environment, 'EMAIL_FROM', true);
  requireMailbox(environment, 'SUPPORT_EMAIL');

  if (readString(environment.EMAIL_REPLY_TO)) {
    requireMailbox(environment, 'EMAIL_REPLY_TO');
  }

  parseInteger(
    environment.EMAIL_REQUEST_TIMEOUT_MS,
    'EMAIL_REQUEST_TIMEOUT_MS',
    1_000,
    30_000,
    10_000
  );

  if (readString(environment.AUTH_DEV_CODE)) {
    throw new Error('AUTH_DEV_CODE must not be configured in production.');
  }

  validateProductionAiConfiguration(environment);

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

function validateProductionAiConfiguration(
  environment: Record<string, unknown>
) {
  if (readString(environment.AI_PROVIDER) !== 'openai') {
    throw new Error('AI_PROVIDER=openai is required in production.');
  }

  requireStrongSecret(environment, 'OPENAI_API_KEY');

  const modelKeys = [
    'OPENAI_DAILY_PLAN_MODEL_FREE',
    'OPENAI_DAILY_PLAN_MODEL_PLUS',
    'OPENAI_DAILY_PLAN_MODEL_PRO'
  ];
  const priceKeys = [
    'OPENAI_DAILY_PLAN_FREE_INPUT_COST_PER_1M_USD',
    'OPENAI_DAILY_PLAN_FREE_OUTPUT_COST_PER_1M_USD',
    'OPENAI_DAILY_PLAN_PLUS_INPUT_COST_PER_1M_USD',
    'OPENAI_DAILY_PLAN_PLUS_OUTPUT_COST_PER_1M_USD',
    'OPENAI_DAILY_PLAN_PRO_INPUT_COST_PER_1M_USD',
    'OPENAI_DAILY_PLAN_PRO_OUTPUT_COST_PER_1M_USD'
  ];

  modelKeys.forEach((key) => requireValue(environment, key));
  priceKeys.forEach((key) => requirePositiveNumber(environment, key));

  if (!parseBoolean(environment.SAFETY_AGENT_ENABLED, 'SAFETY_AGENT_ENABLED', false)) {
    throw new Error('SAFETY_AGENT_ENABLED=true is required in production.');
  }
  if (readString(environment.SAFETY_AGENT_PROVIDER) !== 'openai') {
    throw new Error('SAFETY_AGENT_PROVIDER=openai is required in production.');
  }

  if (
    !parseBoolean(
      environment.AI_COST_CEILING_ENFORCEMENT_ENABLED,
      'AI_COST_CEILING_ENFORCEMENT_ENABLED',
      false
    )
  ) {
    throw new Error(
      'AI_COST_CEILING_ENFORCEMENT_ENABLED=true is required in production.'
    );
  }

  [
    'AI_MONTHLY_COST_CEILING_FREE_USD',
    'AI_MONTHLY_COST_CEILING_PLUS_USD',
    'AI_MONTHLY_COST_CEILING_PRO_USD'
  ].forEach((key) => requirePositiveNumber(environment, key));
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

function requirePositiveNumber(
  environment: Record<string, unknown>,
  name: string
) {
  const value = Number(requireValue(environment, name));

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number in production.`);
  }

  return value;
}

function requireMailbox(
  environment: Record<string, unknown>,
  name: string,
  allowDisplayName = false
) {
  const value = requireValue(environment, name);
  const address = allowDisplayName
    ? value.match(/<([^<>]+)>$/)?.[1] ?? value
    : value;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    throw new Error(`${name} must contain a valid email address.`);
  }

  return value;
}

function requireProductionHttpsUrl(
  environment: Record<string, unknown>,
  name: string
) {
  const value = requireValue(environment, name);
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid HTTPS URL in production.`);
  }

  if (
    url.protocol !== 'https:'
    || url.username
    || url.password
    || ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
  ) {
    throw new Error(`${name} must be a public HTTPS URL without credentials in production.`);
  }

  return url.toString();
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : undefined;
}
