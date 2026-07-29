import type {
  BillingEnvironment,
  BillingLifecycleEventType,
  BillingProductKey,
  BillingProviderKey,
  BillingStore,
  BillingSubscriptionStatus,
  SubscriptionPlan
} from '@optime/shared-types';

export interface BillingProviderEventRequest {
  headers: Readonly<Record<string, string | undefined>>;
  rawBody: string | Uint8Array;
  receivedAt: Date;
}

export interface NormalizedBillingEvent {
  provider: BillingProviderKey;
  providerEventId: string;
  eventType: BillingLifecycleEventType;
  environment: BillingEnvironment;
  store: BillingStore;
  providerCustomerId: string;
  providerSubscriptionId?: string | null;
  providerTransactionId?: string | null;
  originalTransactionId?: string | null;
  providerProductId?: string | null;
  productKey?: BillingProductKey | null;
  appUserId?: string | null;
  occurredAt: Date;
}

export interface NormalizedBillingSubscriptionState {
  provider: BillingProviderKey;
  environment: BillingEnvironment;
  store: BillingStore;
  appUserId: string;
  providerCustomerId: string;
  providerSubscriptionId?: string | null;
  providerTransactionId?: string | null;
  originalTransactionId?: string | null;
  providerProductId: string;
  productKey: BillingProductKey;
  plan: Exclude<SubscriptionPlan, 'FREE'>;
  status: BillingSubscriptionStatus;
  startsAt: Date;
  expiresAt?: Date | null;
  canceledAt?: Date | null;
  graceEndsAt?: Date | null;
  willRenew?: boolean | null;
}

export interface BillingProviderAdapter {
  readonly provider: BillingProviderKey;

  verifyAndNormalizeEvent(
    input: BillingProviderEventRequest
  ): Promise<NormalizedBillingEvent>;

  reconcileCustomer(appUserId: string): Promise<NormalizedBillingSubscriptionState[]>;
}
