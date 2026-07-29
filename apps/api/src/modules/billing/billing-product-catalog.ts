import type {
  BillingProductCatalogEntry,
  BillingProductKey
} from '@optime/shared-types';

export const BILLING_PRODUCT_CATALOG = {
  PLUS_MONTHLY: {
    key: 'PLUS_MONTHLY',
    plan: 'PLUS',
    period: 'MONTHLY',
    appleProductId: 'com.optime.app.plus.monthly',
    googleSubscriptionId: 'optime_plus',
    googleBasePlanId: 'monthly',
    revenueCatEntitlement: 'plus'
  },
  PLUS_ANNUAL: {
    key: 'PLUS_ANNUAL',
    plan: 'PLUS',
    period: 'ANNUAL',
    appleProductId: 'com.optime.app.plus.annual',
    googleSubscriptionId: 'optime_plus',
    googleBasePlanId: 'annual',
    revenueCatEntitlement: 'plus'
  },
  PRO_MONTHLY: {
    key: 'PRO_MONTHLY',
    plan: 'PRO',
    period: 'MONTHLY',
    appleProductId: 'com.optime.app.pro.monthly',
    googleSubscriptionId: 'optime_pro',
    googleBasePlanId: 'monthly',
    revenueCatEntitlement: 'pro'
  },
  PRO_ANNUAL: {
    key: 'PRO_ANNUAL',
    plan: 'PRO',
    period: 'ANNUAL',
    appleProductId: 'com.optime.app.pro.annual',
    googleSubscriptionId: 'optime_pro',
    googleBasePlanId: 'annual',
    revenueCatEntitlement: 'pro'
  }
} as const satisfies Record<BillingProductKey, BillingProductCatalogEntry>;

export function getBillingProduct(key: BillingProductKey) {
  return BILLING_PRODUCT_CATALOG[key];
}
