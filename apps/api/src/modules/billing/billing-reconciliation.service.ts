import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  BillingEventProvider,
  SubscriptionEnvironment,
  SubscriptionProvider,
  SubscriptionStatus
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { BILLING_PROVIDER } from './billing-provider.token';
import { BillingEventsService } from './billing-events.service';
import { getBillingProduct } from './billing-product-catalog';
import type {
  BillingProviderAdapter,
  BillingProviderEventRequest,
  NormalizedBillingEvent,
  NormalizedBillingSubscriptionState
} from './billing-provider.interface';

@Injectable()
export class BillingReconciliationService {
  private readonly logger = new Logger(BillingReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billingEvents: BillingEventsService,
    @Inject(BILLING_PROVIDER)
    private readonly provider: BillingProviderAdapter
  ) {}

  async processWebhook(input: BillingProviderEventRequest) {
    const normalized = await this.provider.verifyAndNormalizeEvent(input);
    const user = normalized.appUserId
      ? await this.prisma.user.findUnique({
          where: { id: normalized.appUserId },
          select: { id: true }
        })
      : null;
    const recorded = await this.billingEvents.recordReceived({
      provider: BillingEventProvider.REVENUECAT,
      providerEventId: normalized.providerEventId,
      eventType: normalized.eventType,
      environment: toPrismaEnvironment(normalized.environment),
      store: toPrismaProvider(normalized.store),
      userId: user?.id,
      providerCustomerId: normalized.providerCustomerId,
      providerProductId: normalized.providerProductId,
      occurredAt: normalized.occurredAt
    });

    if (recorded.duplicate) {
      this.logger.log(
        `RevenueCat webhook replay ignored; eventId=${normalized.providerEventId}`
      );
      return { received: true, duplicate: true };
    }

    if (!user) {
      await this.billingEvents.markFailed(
        recorded.event.id,
        'billing_user_not_found'
      );
      this.logger.warn(
        `RevenueCat webhook user unresolved; eventId=${normalized.providerEventId}`
      );
      return { received: true, processed: false };
    }

    if (shouldIgnoreEvent(normalized)) {
      await this.billingEvents.markIgnored(recorded.event.id);
      return { received: true, ignored: true };
    }

    if (!normalized.productKey || !normalized.providerProductId) {
      await this.billingEvents.markFailed(
        recorded.event.id,
        'billing_product_not_mapped'
      );
      this.logger.warn(
        `RevenueCat product mapping missing; eventId=${normalized.providerEventId}`
      );
      return { received: true, processed: false };
    }

    try {
      const subscription = await this.applyState(
        eventToSubscriptionState(normalized, user.id),
        normalized.occurredAt
      );

      if (!subscription) {
        await this.billingEvents.markIgnored(recorded.event.id);
        this.logger.log(
          `RevenueCat stale event ignored; eventId=${normalized.providerEventId}`
        );
        return { received: true, stale: true };
      }

      await this.billingEvents.markProcessed(
        recorded.event.id,
        subscription.id
      );
      return { received: true, processed: true };
    } catch (error) {
      if (error instanceof BillingOwnershipConflictError) {
        await this.billingEvents.markFailed(
          recorded.event.id,
          'billing_ownership_conflict'
        );
        this.logger.warn(
          `RevenueCat ownership conflict; eventId=${normalized.providerEventId}`
        );
        return { received: true, processed: false };
      }
      await this.billingEvents
        .markFailed(recorded.event.id, 'billing_reconciliation_failed')
        .catch(() => undefined);
      this.logger.error(
        `RevenueCat event processing failed; eventId=${normalized.providerEventId}`
      );
      throw error;
    }
  }

  async reconcileCustomer(userId: string) {
    const states = await this.provider.reconcileCustomer(userId);
    const verifiedAt = new Date();
    const appliedIds: string[] = [];

    for (const state of states) {
      if (state.appUserId !== userId) {
        this.logger.warn('RevenueCat reconciliation ownership mismatch');
        continue;
      }
      const subscription = await this.applyState(state, verifiedAt, true);
      if (subscription) appliedIds.push(subscription.id);
    }

    return {
      reconciled: true,
      subscriptionCount: appliedIds.length
    };
  }

  private async applyState(
    state: NormalizedBillingSubscriptionState,
    providerEventAt: Date,
    forceVerification = false
  ) {
    const provider = toPrismaProvider(state.store);
    const environment = toPrismaEnvironment(state.environment);
    const providerSubscriptionId =
      state.providerSubscriptionId ??
      state.originalTransactionId ??
      `${state.providerCustomerId}:${state.providerProductId}`;
    const existingByProviderId = await this.prisma.subscription.findUnique({
      where: {
        provider_environment_providerSubscriptionId: {
          provider,
          environment,
          providerSubscriptionId
        }
      }
    });
    const existing =
      existingByProviderId ??
      (await this.prisma.subscription.findFirst({
        where: {
          userId: state.appUserId,
          provider,
          environment,
          providerProductId: state.providerProductId
        },
        orderBy: { updatedAt: 'desc' }
      }));

    if (
      !forceVerification &&
      existing?.lastProviderEventAt &&
      existing.lastProviderEventAt.getTime() > providerEventAt.getTime()
    ) {
      return null;
    }

    if (existing && existing.userId !== state.appUserId) {
      throw new BillingOwnershipConflictError();
    }

    return this.prisma.subscription.upsert({
      where: existing
        ? { id: existing.id }
        : {
            provider_environment_providerSubscriptionId: {
              provider,
              environment,
              providerSubscriptionId
            }
          },
      create: {
        userId: state.appUserId,
        plan: state.plan,
        status: toPrismaStatus(state.status),
        provider,
        environment,
        providerCustomerId: state.providerCustomerId,
        providerSubscriptionId,
        providerTransactionId: state.providerTransactionId,
        originalTransactionId: state.originalTransactionId,
        providerProductId: state.providerProductId,
        startsAt: state.startsAt,
        expiresAt: state.expiresAt,
        canceledAt: state.canceledAt,
        graceEndsAt: state.graceEndsAt,
        willRenew: state.willRenew,
        lastVerifiedAt: new Date(),
        lastProviderEventAt: providerEventAt
      },
      update: {
        userId: state.appUserId,
        plan: state.plan,
        status: toPrismaStatus(state.status),
        providerCustomerId: state.providerCustomerId,
        providerSubscriptionId,
        providerTransactionId: state.providerTransactionId,
        originalTransactionId: state.originalTransactionId,
        providerProductId: state.providerProductId,
        startsAt: state.startsAt,
        expiresAt: state.expiresAt,
        canceledAt: state.canceledAt,
        graceEndsAt: state.graceEndsAt,
        willRenew: state.willRenew,
        lastVerifiedAt: new Date(),
        lastProviderEventAt: providerEventAt
      }
    });
  }
}

function shouldIgnoreEvent(event: NormalizedBillingEvent) {
  return ['UNKNOWN', 'PRODUCT_CHANGE', 'TRANSFER'].includes(event.eventType);
}

function eventToSubscriptionState(
  event: NormalizedBillingEvent,
  userId: string
): NormalizedBillingSubscriptionState {
  const product = getBillingProduct(event.productKey!);
  const status = resolveEventStatus(event);

  return {
    provider: event.provider,
    environment: event.environment,
    store: event.store,
    appUserId: userId,
    providerCustomerId: event.providerCustomerId,
    providerSubscriptionId:
      event.providerSubscriptionId ??
      event.originalTransactionId ??
      event.providerTransactionId,
    providerTransactionId: event.providerTransactionId,
    originalTransactionId: event.originalTransactionId,
    providerProductId: event.providerProductId!,
    productKey: product.key,
    plan: product.plan,
    status,
    startsAt: event.purchasedAt ?? event.occurredAt,
    expiresAt: event.expiresAt,
    canceledAt: event.eventType === 'CANCELLATION' ? event.occurredAt : null,
    graceEndsAt: event.graceEndsAt,
    willRenew: resolveWillRenew(event.eventType)
  };
}

function resolveEventStatus(
  event: NormalizedBillingEvent
): NormalizedBillingSubscriptionState['status'] {
  switch (event.eventType) {
    case 'CANCELLATION':
      return 'CANCELED';
    case 'EXPIRATION':
    case 'REFUND':
    case 'REVOCATION':
      return 'EXPIRED';
    case 'BILLING_ISSUE':
      return event.graceEndsAt && event.graceEndsAt.getTime() > Date.now()
        ? 'GRACE_PERIOD'
        : 'PAST_DUE';
    default:
      return event.periodType === 'TRIAL' ? 'TRIALING' : 'ACTIVE';
  }
}

function resolveWillRenew(eventType: NormalizedBillingEvent['eventType']) {
  if (['CANCELLATION', 'EXPIRATION', 'REFUND', 'REVOCATION'].includes(eventType)) {
    return false;
  }
  return true;
}

function toPrismaProvider(store: NormalizedBillingEvent['store']) {
  return store === 'APP_STORE'
    ? SubscriptionProvider.APP_STORE
    : SubscriptionProvider.GOOGLE_PLAY;
}

function toPrismaEnvironment(
  environment: NormalizedBillingEvent['environment']
) {
  return environment === 'SANDBOX'
    ? SubscriptionEnvironment.SANDBOX
    : SubscriptionEnvironment.PRODUCTION;
}

function toPrismaStatus(
  status: NormalizedBillingSubscriptionState['status']
) {
  return SubscriptionStatus[status];
}

class BillingOwnershipConflictError extends Error {}
