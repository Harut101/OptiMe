import { resolveBillingConfig } from './billing.config';

describe('billing config', () => {
  it('is disabled by default without RevenueCat secrets', () => {
    expect(resolveBillingConfig({})).toEqual({
      enabled: false,
      provider: 'REVENUECAT',
      reconciliationTimeoutMs: 10_000,
      revenueCatApiBaseUrl: 'https://api.revenuecat.com/v1',
      revenueCatSecretApiKey: null,
      revenueCatWebhookAuthToken: null,
      revenueCatWebhookSigningSecret: null
    });
  });

  it('requires both backend secrets when billing is enabled', () => {
    expect(() =>
      resolveBillingConfig({
        BILLING_ENABLED: 'true',
        BILLING_PROVIDER: 'revenuecat'
      })
    ).toThrow(
      'REVENUECAT_SECRET_API_KEY must be a non-placeholder secret when billing is enabled.'
    );

    expect(() =>
      resolveBillingConfig({
        BILLING_ENABLED: 'true',
        BILLING_PROVIDER: 'revenuecat',
        REVENUECAT_SECRET_API_KEY: 'secret-api-key-long-enough'
      })
    ).toThrow(
      'REVENUECAT_WEBHOOK_AUTH_TOKEN must be a non-placeholder secret when billing is enabled.'
    );

    expect(() =>
      resolveBillingConfig({
        BILLING_ENABLED: 'true',
        BILLING_PROVIDER: 'revenuecat',
        REVENUECAT_SECRET_API_KEY: 'secret-api-key-long-enough',
        REVENUECAT_WEBHOOK_AUTH_TOKEN: 'webhook-auth-token-long-enough'
      })
    ).toThrow(
      'REVENUECAT_WEBHOOK_SIGNING_SECRET must be a non-placeholder secret when billing is enabled.'
    );
  });

  it('accepts enabled RevenueCat config and bounded timeout', () => {
    expect(
      resolveBillingConfig({
        BILLING_ENABLED: 'true',
        BILLING_PROVIDER: 'revenuecat',
        BILLING_RECONCILIATION_TIMEOUT_MS: '15000',
        REVENUECAT_SECRET_API_KEY: 'secret-api-key-long-enough',
        REVENUECAT_WEBHOOK_AUTH_TOKEN: 'webhook-auth-token-long-enough',
        REVENUECAT_WEBHOOK_SIGNING_SECRET: 'webhook-signing-secret-long-enough'
      })
    ).toEqual({
      enabled: true,
      provider: 'REVENUECAT',
      reconciliationTimeoutMs: 15_000,
      revenueCatApiBaseUrl: 'https://api.revenuecat.com/v1',
      revenueCatSecretApiKey: 'secret-api-key-long-enough',
      revenueCatWebhookAuthToken: 'webhook-auth-token-long-enough',
      revenueCatWebhookSigningSecret: 'webhook-signing-secret-long-enough'
    });
  });

  it('rejects unsupported providers and invalid config values', () => {
    expect(() =>
      resolveBillingConfig({ BILLING_PROVIDER: 'direct-store' })
    ).toThrow('BILLING_PROVIDER must be revenuecat.');

    expect(() =>
      resolveBillingConfig({ BILLING_ENABLED: 'sometimes' })
    ).toThrow('BILLING_ENABLED must be true or false.');

    expect(() =>
      resolveBillingConfig({ BILLING_RECONCILIATION_TIMEOUT_MS: '500' })
    ).toThrow(
      'BILLING_RECONCILIATION_TIMEOUT_MS must be an integer between 1000 and 30000.'
    );
  });
});
