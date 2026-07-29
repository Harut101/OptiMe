import { createHmac } from 'node:crypto';

import type { BillingConfig } from './billing.config';
import { RevenueCatBillingProviderService } from './revenuecat-billing-provider.service';

const config: BillingConfig = {
  enabled: true,
  provider: 'REVENUECAT',
  reconciliationTimeoutMs: 10_000,
  revenueCatApiBaseUrl: 'https://api.revenuecat.com/v1',
  revenueCatSecretApiKey: 'secret-api-key-long-enough',
  revenueCatWebhookAuthToken: 'webhook-auth-token-long-enough',
  revenueCatWebhookSigningSecret: 'webhook-signing-secret-long-enough'
};

describe('RevenueCatBillingProviderService', () => {
  const service = new RevenueCatBillingProviderService(config);

  it('authenticates and normalizes a RevenueCat purchase event', async () => {
    const receivedAt = new Date('2026-07-29T12:00:00.000Z');
    const rawBody = JSON.stringify({
      api_version: '1.0',
      event: {
        id: 'event-1',
        type: 'INITIAL_PURCHASE',
        app_user_id: 'user-1',
        aliases: [],
        environment: 'SANDBOX',
        store: 'APP_STORE',
        event_timestamp_ms: receivedAt.getTime(),
        purchased_at_ms: receivedAt.getTime(),
        expiration_at_ms: receivedAt.getTime() + 2_592_000_000,
        product_id: 'com.optime.app.plus.monthly',
        transaction_id: 'transaction-1',
        original_transaction_id: 'original-1',
        period_type: 'NORMAL'
      }
    });
    const timestamp = Math.floor(receivedAt.getTime() / 1000);

    await expect(
      service.verifyAndNormalizeEvent({
        headers: {
          authorization: config.revenueCatWebhookAuthToken!,
          'x-revenuecat-webhook-signature': sign(rawBody, timestamp)
        },
        rawBody,
        receivedAt
      })
    ).resolves.toEqual(
      expect.objectContaining({
        providerEventId: 'event-1',
        eventType: 'INITIAL_PURCHASE',
        productKey: 'PLUS_MONTHLY',
        store: 'APP_STORE',
        appUserId: 'user-1'
      })
    );
  });

  it('rejects invalid authorization before parsing the payload', async () => {
    await expect(
      service.verifyAndNormalizeEvent({
        headers: { authorization: 'wrong' },
        rawBody: '{private-payload}',
        receivedAt: new Date()
      })
    ).rejects.toMatchObject({ safeCode: 'revenuecat_unauthorized' });
  });

  it('rejects an invalid signature', async () => {
    const now = new Date();
    await expect(
      service.verifyAndNormalizeEvent({
        headers: {
          authorization: config.revenueCatWebhookAuthToken!,
          'x-revenuecat-webhook-signature':
            `t=${Math.floor(now.getTime() / 1000)},v1=${'0'.repeat(64)}`
        },
        rawBody: '{}',
        receivedAt: now
      })
    ).rejects.toMatchObject({ safeCode: 'revenuecat_invalid_signature' });
  });
});

function sign(rawBody: string, timestamp: number) {
  const signature = createHmac(
    'sha256',
    config.revenueCatWebhookSigningSecret!
  )
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}
