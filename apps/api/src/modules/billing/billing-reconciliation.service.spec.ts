import {
  BillingEventProvider,
  SubscriptionEnvironment,
  SubscriptionProvider
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { BillingEventsService } from './billing-events.service';
import type {
  BillingProviderAdapter,
  NormalizedBillingEvent
} from './billing-provider.interface';
import { BillingReconciliationService } from './billing-reconciliation.service';

describe('BillingReconciliationService', () => {
  const findUser = jest.fn();
  const findSubscription = jest.fn();
  const findFirstSubscription = jest.fn();
  const upsertSubscription = jest.fn();
  const provider = {
    provider: 'REVENUECAT',
    verifyAndNormalizeEvent: jest.fn(),
    reconcileCustomer: jest.fn()
  } as jest.Mocked<BillingProviderAdapter>;
  const events = {
    recordReceived: jest.fn(),
    markProcessed: jest.fn(),
    markIgnored: jest.fn(),
    markFailed: jest.fn()
  } as unknown as jest.Mocked<BillingEventsService>;
  const prisma = {
    user: { findUnique: findUser },
    subscription: {
      findUnique: findSubscription,
      findFirst: findFirstSubscription,
      upsert: upsertSubscription
    }
  } as unknown as PrismaService;
  const service = new BillingReconciliationService(prisma, events, provider);

  beforeEach(() => {
    jest.clearAllMocks();
    findUser.mockResolvedValue({ id: 'user-1' });
    findSubscription.mockResolvedValue(null);
    findFirstSubscription.mockResolvedValue(null);
    upsertSubscription.mockResolvedValue({ id: 'subscription-1' });
    (events.recordReceived as jest.Mock).mockResolvedValue({
      duplicate: false,
      event: { id: 'billing-event-1' }
    });
  });

  it('creates an active subscription and processes the event', async () => {
    provider.verifyAndNormalizeEvent.mockResolvedValue(baseEvent());

    await expect(
      service.processWebhook({
        headers: {},
        rawBody: '{}',
        receivedAt: new Date()
      })
    ).resolves.toEqual({ received: true, processed: true });

    expect(upsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          plan: 'PLUS',
          status: 'ACTIVE',
          provider: SubscriptionProvider.APP_STORE,
          environment: SubscriptionEnvironment.SANDBOX
        })
      })
    );
    expect(events.markProcessed).toHaveBeenCalledWith(
      'billing-event-1',
      'subscription-1'
    );
  });

  it('does not mutate a replayed event', async () => {
    provider.verifyAndNormalizeEvent.mockResolvedValue(baseEvent());
    (events.recordReceived as jest.Mock).mockResolvedValue({
      duplicate: true,
      event: { id: 'billing-event-1' }
    });

    await expect(
      service.processWebhook({
        headers: {},
        rawBody: '{}',
        receivedAt: new Date()
      })
    ).resolves.toEqual({ received: true, duplicate: true });
    expect(upsertSubscription).not.toHaveBeenCalled();
  });

  it('ignores an event older than the stored provider event', async () => {
    provider.verifyAndNormalizeEvent.mockResolvedValue(baseEvent());
    findSubscription.mockResolvedValue({
      lastProviderEventAt: new Date('2026-07-30T00:00:00.000Z')
    });

    await expect(
      service.processWebhook({
        headers: {},
        rawBody: '{}',
        receivedAt: new Date()
      })
    ).resolves.toEqual({ received: true, stale: true });
    expect(upsertSubscription).not.toHaveBeenCalled();
    expect(events.markIgnored).toHaveBeenCalledWith('billing-event-1');
  });

  it('keeps cancellation access metadata until its expiration', async () => {
    provider.verifyAndNormalizeEvent.mockResolvedValue({
      ...baseEvent(),
      eventType: 'CANCELLATION'
    });

    await service.processWebhook({
      headers: {},
      rawBody: '{}',
      receivedAt: new Date()
    });

    expect(upsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          status: 'CANCELED',
          expiresAt: new Date('2026-08-29T12:00:00.000Z'),
          willRenew: false
        })
      })
    );
  });

  it('does not transfer an existing provider subscription to another user', async () => {
    provider.verifyAndNormalizeEvent.mockResolvedValue(baseEvent());
    findSubscription.mockResolvedValue({
      id: 'subscription-other',
      userId: 'user-other',
      lastProviderEventAt: null
    });

    await expect(
      service.processWebhook({
        headers: {},
        rawBody: '{}',
        receivedAt: new Date()
      })
    ).resolves.toEqual({ received: true, processed: false });

    expect(upsertSubscription).not.toHaveBeenCalled();
    expect(events.markFailed).toHaveBeenCalledWith(
      'billing-event-1',
      'billing_ownership_conflict'
    );
  });
});

function baseEvent(): NormalizedBillingEvent {
  return {
    provider: 'REVENUECAT',
    providerEventId: 'event-1',
    eventType: 'INITIAL_PURCHASE',
    environment: 'SANDBOX',
    store: 'APP_STORE',
    providerCustomerId: 'user-1',
    providerSubscriptionId: 'original-1',
    providerTransactionId: 'transaction-1',
    originalTransactionId: 'original-1',
    providerProductId: 'com.optime.app.plus.monthly',
    productKey: 'PLUS_MONTHLY',
    appUserId: 'user-1',
    aliases: [],
    occurredAt: new Date('2026-07-29T12:00:00.000Z'),
    purchasedAt: new Date('2026-07-29T12:00:00.000Z'),
    expiresAt: new Date('2026-08-29T12:00:00.000Z'),
    periodType: 'NORMAL'
  };
}
