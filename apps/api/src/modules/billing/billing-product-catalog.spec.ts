import { BILLING_PRODUCT_KEYS } from '@optime/shared-types';

import {
  BILLING_PRODUCT_CATALOG,
  getBillingProduct
} from './billing-product-catalog';

describe('billing product catalog', () => {
  it('contains every canonical billing product exactly once', () => {
    expect(Object.keys(BILLING_PRODUCT_CATALOG).sort()).toEqual(
      [...BILLING_PRODUCT_KEYS].sort()
    );
    expect(
      new Set(
        Object.values(BILLING_PRODUCT_CATALOG).map((product) => product.appleProductId)
      ).size
    ).toBe(BILLING_PRODUCT_KEYS.length);
  });

  it('maps Plus and Pro periods to stable store identities', () => {
    expect(getBillingProduct('PLUS_MONTHLY')).toMatchObject({
      plan: 'PLUS',
      period: 'MONTHLY',
      appleProductId: 'com.optime.app.plus.monthly',
      googleSubscriptionId: 'optime_plus',
      googleBasePlanId: 'monthly',
      revenueCatEntitlement: 'plus'
    });
    expect(getBillingProduct('PRO_ANNUAL')).toMatchObject({
      plan: 'PRO',
      period: 'ANNUAL',
      appleProductId: 'com.optime.app.pro.annual',
      googleSubscriptionId: 'optime_pro',
      googleBasePlanId: 'annual',
      revenueCatEntitlement: 'pro'
    });
  });
});
