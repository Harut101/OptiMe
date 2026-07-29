import type { BillingProviderKey } from '@optime/shared-types';

export interface BillingConfig {
  enabled: boolean;
  provider: BillingProviderKey;
  reconciliationTimeoutMs: number;
  revenueCatApiBaseUrl: string;
  revenueCatSecretApiKey: string | null;
  revenueCatWebhookAuthToken: string | null;
  revenueCatWebhookSigningSecret: string | null;
}

const DEFAULT_RECONCILIATION_TIMEOUT_MS = 10_000;

export function resolveBillingConfig(
  environment: Record<string, unknown>
): BillingConfig {
  const enabled = parseBoolean(environment.BILLING_ENABLED, 'BILLING_ENABLED', false);
  const provider = parseProvider(environment.BILLING_PROVIDER);
  const reconciliationTimeoutMs = parseInteger(
    environment.BILLING_RECONCILIATION_TIMEOUT_MS,
    'BILLING_RECONCILIATION_TIMEOUT_MS',
    1_000,
    30_000,
    DEFAULT_RECONCILIATION_TIMEOUT_MS
  );

  if (!enabled) {
    return {
      enabled: false,
      provider,
      reconciliationTimeoutMs,
      revenueCatApiBaseUrl: parseUrl(environment.REVENUECAT_API_BASE_URL),
      revenueCatSecretApiKey: null,
      revenueCatWebhookAuthToken: null,
      revenueCatWebhookSigningSecret: null
    };
  }

  return {
    enabled: true,
    provider,
    reconciliationTimeoutMs,
    revenueCatApiBaseUrl: parseUrl(environment.REVENUECAT_API_BASE_URL),
    revenueCatSecretApiKey: requireSecret(
      environment.REVENUECAT_SECRET_API_KEY,
      'REVENUECAT_SECRET_API_KEY'
    ),
    revenueCatWebhookAuthToken: requireSecret(
      environment.REVENUECAT_WEBHOOK_AUTH_TOKEN,
      'REVENUECAT_WEBHOOK_AUTH_TOKEN'
    ),
    revenueCatWebhookSigningSecret: requireSecret(
      environment.REVENUECAT_WEBHOOK_SIGNING_SECRET,
      'REVENUECAT_WEBHOOK_SIGNING_SECRET'
    )
  };
}

function parseUrl(value: unknown) {
  const normalized = readString(value) ?? 'https://api.revenuecat.com/v1';

  try {
    const url = new URL(normalized);
    if (url.protocol !== 'https:') throw new Error();
    return url.toString().replace(/\/$/, '');
  } catch {
    throw new Error('REVENUECAT_API_BASE_URL must be a valid HTTPS URL.');
  }
}

function parseProvider(value: unknown): BillingProviderKey {
  const normalized = readString(value)?.toLowerCase() ?? 'revenuecat';

  if (normalized !== 'revenuecat') {
    throw new Error('BILLING_PROVIDER must be revenuecat.');
  }

  return 'REVENUECAT';
}

function requireSecret(value: unknown, name: string) {
  const normalized = readString(value);

  if (!normalized || normalized.length < 16 || normalized.includes('replace-with')) {
    throw new Error(`${name} must be a non-placeholder secret when billing is enabled.`);
  }

  return normalized;
}

function parseBoolean(
  value: unknown,
  name: string,
  fallback: boolean
) {
  const normalized = readString(value)?.toLowerCase();

  if (!normalized) return fallback;
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw new Error(`${name} must be true or false.`);
}

function parseInteger(
  value: unknown,
  name: string,
  minimum: number,
  maximum: number,
  fallback: number
) {
  const normalized = readString(value);

  if (!normalized) return fallback;

  const parsed = Number(normalized);

  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }

  return parsed;
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : undefined;
}
