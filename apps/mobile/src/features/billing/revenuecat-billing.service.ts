import { Linking, Platform } from 'react-native';
import Purchases, {
  PURCHASES_ERROR_CODE,
  type PurchasesError,
  type PurchasesPackage
} from 'react-native-purchases';

import { reconcileBilling } from '@/api/account';
import {
  BILLING_ENABLED,
  REVENUECAT_ANDROID_API_KEY,
  REVENUECAT_IOS_API_KEY
} from '@/config/env';
import { BillingError } from './billing.error';
import type {
  BillingAvailability,
  BillingOffer,
  BillingPeriod,
  BillingProductKey
} from './billing.types';

const PRODUCT_KEYS_BY_IDENTIFIER: Record<string, BillingProductKey> = {
  'com.optime.app.plus.monthly': 'PLUS_MONTHLY',
  'com.optime.app.plus.annual': 'PLUS_ANNUAL',
  'com.optime.app.pro.monthly': 'PRO_MONTHLY',
  'com.optime.app.pro.annual': 'PRO_ANNUAL',
  'optime_plus:monthly': 'PLUS_MONTHLY',
  'optime_plus:annual': 'PLUS_ANNUAL',
  'optime_pro:monthly': 'PRO_MONTHLY',
  'optime_pro:annual': 'PRO_ANNUAL',
  plus_monthly: 'PLUS_MONTHLY',
  plus_annual: 'PLUS_ANNUAL',
  pro_monthly: 'PRO_MONTHLY',
  pro_annual: 'PRO_ANNUAL'
};

let configuredUserId: string | null = null;
let sdkConfigured = false;
let packageCache = new Map<BillingProductKey, PurchasesPackage>();

export function getBillingAvailability(): BillingAvailability {
  if (!BILLING_ENABLED) {
    return { enabled: false, available: false, reason: 'BILLING_DISABLED' };
  }

  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return { enabled: true, available: false, reason: 'UNSUPPORTED_PLATFORM' };
  }

  if (!getPlatformApiKey()) {
    return { enabled: true, available: false, reason: 'MISSING_API_KEY' };
  }

  return { enabled: true, available: true };
}

export async function getBillingOffers(userId: string): Promise<BillingOffer[]> {
  await ensureConfigured(userId);
  const offerings = await safePurchasesCall(() => Purchases.getOfferings());
  const packages = offerings.current?.availablePackages ?? [];
  const nextCache = new Map<BillingProductKey, PurchasesPackage>();
  const offers: BillingOffer[] = [];

  for (const item of packages) {
    const key = resolveBillingProductKey(item);
    if (!key || nextCache.has(key)) continue;

    nextCache.set(key, item);
    offers.push({
      key,
      plan: key.startsWith('PLUS') ? 'PLUS' : 'PRO',
      period: key.endsWith('MONTHLY') ? 'MONTHLY' : 'ANNUAL',
      localizedPrice: item.product.priceString,
      localizedPricePerMonth: item.product.pricePerMonthString
    });
  }

  packageCache = nextCache;
  return offers;
}

export async function purchaseBillingProduct(
  userId: string,
  productKey: BillingProductKey
) {
  await ensureConfigured(userId);
  let selectedPackage = packageCache.get(productKey);

  if (!selectedPackage) {
    await getBillingOffers(userId);
    selectedPackage = packageCache.get(productKey);
  }

  if (!selectedPackage) {
    throw new BillingError('OFFERING_UNAVAILABLE');
  }

  await safePurchasesCall(() => Purchases.purchasePackage(selectedPackage));
  return reconcileAfterStoreAction();
}

export async function restoreBillingPurchases(userId: string) {
  await ensureConfigured(userId);
  await safePurchasesCall(() => Purchases.restorePurchases());
  return reconcileAfterStoreAction();
}

export async function openBillingManagement(userId: string) {
  await ensureConfigured(userId);
  const customerInfo = await safePurchasesCall(() => Purchases.getCustomerInfo());
  const managementUrl = customerInfo.managementURL;

  if (!managementUrl || !(await Linking.canOpenURL(managementUrl))) {
    throw new BillingError('MANAGEMENT_UNAVAILABLE');
  }

  await Linking.openURL(managementUrl);
}

export async function disconnectBillingIdentity() {
  if (!sdkConfigured || !configuredUserId) return;

  try {
    await Purchases.logOut();
  } catch {
    // Auth logout must never be blocked by an optional billing SDK cleanup.
  } finally {
    configuredUserId = null;
    packageCache.clear();
  }
}

export function resolveBillingProductKey(
  item: Pick<PurchasesPackage, 'identifier' | 'product'>
): BillingProductKey | null {
  const identifiers = [
    item.identifier,
    item.product.identifier,
    item.product.defaultOption?.id
      ? `${item.product.identifier}:${item.product.defaultOption.id}`
      : null
  ].filter((value): value is string => Boolean(value));

  for (const identifier of identifiers) {
    const direct = PRODUCT_KEYS_BY_IDENTIFIER[identifier.toLowerCase()];
    if (direct) return direct;
  }

  return null;
}

export function getDefaultBillingProductKey(
  plan: 'PLUS' | 'PRO',
  period: BillingPeriod
): BillingProductKey {
  return `${plan}_${period}` as BillingProductKey;
}

async function ensureConfigured(userId: string) {
  const availability = getBillingAvailability();
  if (!availability.available) {
    throw new BillingError(availability.reason ?? 'UNKNOWN');
  }

  if (configuredUserId === userId) return;

  if (!sdkConfigured) {
    Purchases.configure({
      apiKey: getPlatformApiKey()!,
      appUserID: userId,
      automaticDeviceIdentifierCollectionEnabled: false
    });
    sdkConfigured = true;
  } else {
    await safePurchasesCall(() => Purchases.logIn(userId));
  }

  configuredUserId = userId;
  packageCache.clear();
}

async function reconcileAfterStoreAction() {
  try {
    return await reconcileBilling();
  } catch (error) {
    throw new BillingError('RECONCILIATION_FAILED', { cause: error });
  }
}

async function safePurchasesCall<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof BillingError) throw error;
    throw mapPurchasesError(error);
  }
}

function mapPurchasesError(error: unknown) {
  const purchasesError = error as Partial<PurchasesError>;
  switch (purchasesError.code) {
    case PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR:
      return new BillingError('PURCHASE_CANCELLED', { cause: error });
    case PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR:
      return new BillingError('PURCHASE_PENDING', { cause: error });
    case PURCHASES_ERROR_CODE.NETWORK_ERROR:
    case PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR:
      return new BillingError('NETWORK_ERROR', { cause: error });
    case PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR:
    case PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR:
    case PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR:
    case PURCHASES_ERROR_CODE.CONFIGURATION_ERROR:
      return new BillingError('STORE_UNAVAILABLE', { cause: error });
    default:
      return new BillingError('UNKNOWN', { cause: error });
  }
}

function getPlatformApiKey() {
  if (Platform.OS === 'ios') return REVENUECAT_IOS_API_KEY;
  if (Platform.OS === 'android') return REVENUECAT_ANDROID_API_KEY;
  return undefined;
}
