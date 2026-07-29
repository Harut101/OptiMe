import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

import { BILLING_CONFIG } from './billing-config.token';
import { BillingProviderError } from './billing.error';
import type {
  BillingProviderAdapter,
  BillingProviderEventRequest,
  NormalizedBillingEvent,
  NormalizedBillingSubscriptionState
} from './billing-provider.interface';
import {
  findBillingProductByProviderId,
  getBillingProduct
} from './billing-product-catalog';
import type { BillingConfig } from './billing.config';

const WEBHOOK_SIGNATURE_TOLERANCE_SECONDS = 300;

const revenueCatWebhookSchema = z.object({
  api_version: z.string().optional(),
  event: z.object({
    id: z.string().min(1).max(255),
    type: z.string().min(1).max(100),
    app_user_id: z.string().min(1).max(255),
    original_app_user_id: z.string().max(255).nullish(),
    aliases: z.array(z.string().max(255)).default([]),
    environment: z.enum(['SANDBOX', 'PRODUCTION']),
    store: z.string().min(1).max(100),
    event_timestamp_ms: z.number().finite(),
    purchased_at_ms: z.number().finite().nullish(),
    expiration_at_ms: z.number().finite().nullish(),
    grace_period_expiration_at_ms: z.number().finite().nullish(),
    product_id: z.string().max(255).nullish(),
    transaction_id: z.string().max(255).nullish(),
    original_transaction_id: z.string().max(255).nullish(),
    period_type: z.string().max(50).nullish(),
    cancel_reason: z.string().max(100).nullish()
  })
});

const revenueCatSubscriberSchema = z.object({
  subscriber: z.object({
    subscriptions: z.record(
      z.object({
        billing_issues_detected_at: z.string().datetime().nullish(),
        expires_date: z.string().datetime().nullish(),
        grace_period_expires_date: z.string().datetime().nullish(),
        is_sandbox: z.boolean(),
        original_purchase_date: z.string().datetime().nullish(),
        period_type: z.string().nullish(),
        purchase_date: z.string().datetime().nullish(),
        refunded_at: z.string().datetime().nullish(),
        store: z.string(),
        store_transaction_id: z.string().max(255).nullish(),
        unsubscribe_detected_at: z.string().datetime().nullish()
      }).passthrough()
    )
  })
});

@Injectable()
export class RevenueCatBillingProviderService implements BillingProviderAdapter {
  readonly provider = 'REVENUECAT' as const;
  private readonly logger = new Logger(RevenueCatBillingProviderService.name);

  constructor(
    @Inject(BILLING_CONFIG)
    private readonly config: BillingConfig
  ) {}

  async verifyAndNormalizeEvent(
    input: BillingProviderEventRequest
  ): Promise<NormalizedBillingEvent> {
    this.assertEnabled();
    this.verifyAuthorization(input.headers.authorization);

    const rawBody =
      typeof input.rawBody === 'string'
        ? Buffer.from(input.rawBody, 'utf8')
        : Buffer.from(input.rawBody);

    this.verifySignature(
      input.headers['x-revenuecat-webhook-signature'],
      rawBody,
      input.receivedAt
    );

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BillingProviderError(
        'revenuecat_invalid_json',
        HttpStatus.BAD_REQUEST,
        'RevenueCat webhook JSON is invalid.'
      );
    }

    const parsed = revenueCatWebhookSchema.safeParse(payload);
    if (!parsed.success) {
      this.logger.warn(
        `RevenueCat webhook validation failed; issueCount=${parsed.error.issues.length}`
      );
      throw new BillingProviderError(
        'revenuecat_invalid_event',
        HttpStatus.BAD_REQUEST,
        'RevenueCat webhook event is invalid.'
      );
    }

    const event = parsed.data.event;
    const store = normalizeStore(event.store);
    const product = event.product_id
      ? findBillingProductByProviderId(event.product_id)
      : undefined;

    return {
      provider: this.provider,
      providerEventId: event.id,
      eventType: normalizeEventType(event.type),
      environment: event.environment,
      store,
      providerCustomerId: event.original_app_user_id ?? event.app_user_id,
      providerSubscriptionId:
        event.original_transaction_id ?? event.transaction_id ?? null,
      providerTransactionId: event.transaction_id ?? null,
      originalTransactionId: event.original_transaction_id ?? null,
      providerProductId: event.product_id ?? null,
      productKey: product?.key ?? null,
      appUserId: event.app_user_id,
      aliases: event.aliases,
      occurredAt: fromMilliseconds(event.event_timestamp_ms, 'event_timestamp_ms'),
      purchasedAt: fromOptionalMilliseconds(event.purchased_at_ms),
      expiresAt: fromOptionalMilliseconds(event.expiration_at_ms),
      graceEndsAt: fromOptionalMilliseconds(event.grace_period_expiration_at_ms),
      periodType: event.period_type?.toUpperCase() === 'TRIAL' ? 'TRIAL' : 'NORMAL',
      cancelReason: event.cancel_reason ?? null
    };
  }

  async reconcileCustomer(
    appUserId: string
  ): Promise<NormalizedBillingSubscriptionState[]> {
    this.assertEnabled();
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.reconciliationTimeoutMs
    );

    try {
      const response = await fetch(
        `${this.config.revenueCatApiBaseUrl}/subscribers/${encodeURIComponent(appUserId)}`,
        {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${this.config.revenueCatSecretApiKey}`
          },
          signal: controller.signal
        }
      );

      if (!response.ok) {
        this.logger.error(
          `RevenueCat reconciliation failed; status=${response.status}`
        );
        throw new BillingProviderError(
          'revenuecat_reconciliation_failed',
          HttpStatus.BAD_GATEWAY,
          'Subscription reconciliation is temporarily unavailable.'
        );
      }

      const parsed = revenueCatSubscriberSchema.safeParse(await response.json());
      if (!parsed.success) {
        throw new BillingProviderError(
          'revenuecat_invalid_subscriber',
          HttpStatus.BAD_GATEWAY,
          'RevenueCat subscriber response is invalid.'
        );
      }

      return Object.entries(parsed.data.subscriber.subscriptions).flatMap(
        ([providerProductId, subscription]) => {
          const product = findBillingProductByProviderId(providerProductId);
          if (!product) return [];

          const expiresAt = parseOptionalDate(subscription.expires_date);
          const graceEndsAt = parseOptionalDate(
            subscription.grace_period_expires_date
          );
          const canceledAt = parseOptionalDate(
            subscription.unsubscribe_detected_at
          );
          const startsAt =
            parseOptionalDate(subscription.purchase_date) ??
            parseOptionalDate(subscription.original_purchase_date) ??
            new Date();

          return [{
            provider: this.provider,
            environment: subscription.is_sandbox
              ? ('SANDBOX' as const)
              : ('PRODUCTION' as const),
            store: normalizeStore(subscription.store),
            appUserId,
            providerCustomerId: appUserId,
            providerSubscriptionId:
              subscription.store_transaction_id ??
              `${appUserId}:${providerProductId}`,
            providerTransactionId: subscription.store_transaction_id,
            providerProductId,
            productKey: product.key,
            plan: getBillingProduct(product.key).plan,
            status: resolveReconciledStatus({
              billingIssueAt: subscription.billing_issues_detected_at,
              canceledAt,
              expiresAt,
              graceEndsAt,
              periodType: subscription.period_type,
              refundedAt: subscription.refunded_at
            }),
            startsAt,
            expiresAt,
            canceledAt,
            graceEndsAt,
            willRenew: !canceledAt && !subscription.refunded_at
          }];
        }
      );
    } catch (error) {
      if (error instanceof BillingProviderError) throw error;
      const safeCode =
        error instanceof Error && error.name === 'AbortError'
          ? 'revenuecat_reconciliation_timeout'
          : 'revenuecat_reconciliation_unavailable';
      this.logger.error(`RevenueCat reconciliation error; reason=${safeCode}`);
      throw new BillingProviderError(
        safeCode,
        HttpStatus.BAD_GATEWAY,
        'Subscription reconciliation is temporarily unavailable.'
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private assertEnabled() {
    if (!this.config.enabled) {
      throw new ServiceUnavailableException({
        code: 'billing_disabled',
        message: 'Billing is not enabled.'
      });
    }
  }

  private verifyAuthorization(value?: string) {
    if (
      !value ||
      !safeEqual(value.trim(), this.config.revenueCatWebhookAuthToken ?? '')
    ) {
      throw new BillingProviderError(
        'revenuecat_unauthorized',
        HttpStatus.UNAUTHORIZED,
        'RevenueCat webhook authorization failed.'
      );
    }
  }

  private verifySignature(
    signatureHeader: string | undefined,
    rawBody: Buffer,
    receivedAt: Date
  ) {
    const signature = parseSignature(signatureHeader);
    const ageSeconds = Math.abs(receivedAt.getTime() / 1000 - signature.timestamp);

    if (ageSeconds > WEBHOOK_SIGNATURE_TOLERANCE_SECONDS) {
      throw new BillingProviderError(
        'revenuecat_stale_signature',
        HttpStatus.UNAUTHORIZED,
        'RevenueCat webhook signature is stale.'
      );
    }

    const expected = createHmac(
      'sha256',
      this.config.revenueCatWebhookSigningSecret ?? ''
    )
      .update(`${signature.timestamp}.`)
      .update(rawBody)
      .digest('hex');

    if (!safeEqual(expected, signature.value)) {
      throw new BillingProviderError(
        'revenuecat_invalid_signature',
        HttpStatus.UNAUTHORIZED,
        'RevenueCat webhook signature is invalid.'
      );
    }
  }
}

function parseSignature(value?: string) {
  const entries = Object.fromEntries(
    (value ?? '').split(',').map((entry) => {
      const [key, item] = entry.trim().split('=', 2);
      return [key, item];
    })
  );
  const timestamp = Number(entries.t);
  const signature = entries.v1;

  if (
    !Number.isSafeInteger(timestamp) ||
    !signature ||
    !/^[a-f0-9]{64}$/i.test(signature)
  ) {
    throw new BillingProviderError(
      'revenuecat_invalid_signature',
      HttpStatus.UNAUTHORIZED,
      'RevenueCat webhook signature is invalid.'
    );
  }

  return { timestamp, value: signature.toLowerCase() };
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function normalizeStore(store: string) {
  switch (store.toUpperCase()) {
    case 'APP_STORE':
    case 'MAC_APP_STORE':
      return 'APP_STORE' as const;
    case 'PLAY_STORE':
    case 'GOOGLE_PLAY':
      return 'GOOGLE_PLAY' as const;
    default:
      throw new BillingProviderError(
        'revenuecat_unsupported_store',
        HttpStatus.BAD_REQUEST,
        'RevenueCat event store is unsupported.'
      );
  }
}

function normalizeEventType(value: string): NormalizedBillingEvent['eventType'] {
  const supported = [
    'INITIAL_PURCHASE',
    'RENEWAL',
    'CANCELLATION',
    'UNCANCELLATION',
    'EXPIRATION',
    'BILLING_ISSUE',
    'PRODUCT_CHANGE',
    'SUBSCRIPTION_EXTENDED',
    'TRANSFER',
    'REFUND',
    'REVOCATION'
  ] as const;
  const normalized = value.toUpperCase();
  return supported.find((type) => type === normalized) ?? 'UNKNOWN';
}

function fromMilliseconds(value: number, field: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BillingProviderError(
      'revenuecat_invalid_event',
      HttpStatus.BAD_REQUEST,
      `RevenueCat ${field} is invalid.`
    );
  }
  return date;
}

function fromOptionalMilliseconds(value?: number | null) {
  return value == null ? null : fromMilliseconds(value, 'timestamp');
}

function parseOptionalDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveReconciledStatus(input: {
  billingIssueAt?: string | null;
  canceledAt: Date | null;
  expiresAt: Date | null;
  graceEndsAt: Date | null;
  periodType?: string | null;
  refundedAt?: string | null;
}): NormalizedBillingSubscriptionState['status'] {
  const now = Date.now();
  if (input.refundedAt) return 'EXPIRED';
  if (input.expiresAt && input.expiresAt.getTime() <= now) return 'EXPIRED';
  if (input.graceEndsAt && input.graceEndsAt.getTime() > now) return 'GRACE_PERIOD';
  if (input.billingIssueAt) return 'PAST_DUE';
  if (input.canceledAt) return 'CANCELED';
  return input.periodType?.toLowerCase() === 'trial' ? 'TRIALING' : 'ACTIVE';
}
