import type { SubscriptionPlan } from '@/types/api';

export type BillingPeriod = 'MONTHLY' | 'ANNUAL';
export type BillingProductKey =
  | 'PLUS_MONTHLY'
  | 'PLUS_ANNUAL'
  | 'PRO_MONTHLY'
  | 'PRO_ANNUAL';

export interface BillingOffer {
  key: BillingProductKey;
  plan: Exclude<SubscriptionPlan, 'FREE'>;
  period: BillingPeriod;
  localizedPrice: string;
  localizedPricePerMonth?: string | null;
}

export interface BillingAvailability {
  enabled: boolean;
  available: boolean;
  reason?: BillingErrorCode;
}

export type BillingErrorCode =
  | 'BILLING_DISABLED'
  | 'UNSUPPORTED_PLATFORM'
  | 'MISSING_API_KEY'
  | 'OFFERING_UNAVAILABLE'
  | 'PURCHASE_CANCELLED'
  | 'PURCHASE_PENDING'
  | 'STORE_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'RECONCILIATION_FAILED'
  | 'MANAGEMENT_UNAVAILABLE'
  | 'UNKNOWN';
