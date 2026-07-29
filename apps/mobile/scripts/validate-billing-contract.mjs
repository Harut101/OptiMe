import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const env = read('src/config/env.ts');
const service = read('src/features/billing/revenuecat-billing.service.ts');
const screen = read('app/subscription.tsx');
const accountApi = read('src/api/account.ts');
const profile = read('app/(tabs)/profile.tsx');
const layout = read('app/_layout.tsx');

for (const key of [
  'EXPO_PUBLIC_BILLING_ENABLED',
  'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY',
  'EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY'
]) {
  assert(env.includes(key), `Mobile billing config is missing ${key}.`);
}

for (const contract of [
  'Purchases.configure({',
  'appUserID: userId',
  'automaticDeviceIdentifierCollectionEnabled: false',
  'Purchases.getOfferings()',
  'item.product.priceString',
  'Purchases.purchasePackage',
  'Purchases.restorePurchases()',
  'reconcileBilling()'
]) {
  assert(service.includes(contract), `RevenueCat adapter is missing ${contract}.`);
}

assert(
  !service.includes('customerInfo.entitlements.active'),
  'Mobile RevenueCat entitlements must never grant OptiMe access.'
);
assert(
  accountApi.includes("apiRequest<BillingReconciliationResponse>('/me/billing/reconcile'"),
  'Purchase and restore must reconcile through the authenticated backend.'
);
assert(
  screen.includes("queryKey: ['entitlements']") &&
    screen.includes("queryKey: ['billing-offerings', user?.id]"),
  'Subscription UI must separate backend access from store offerings.'
);
assert(
  screen.includes('purchase.isPending') && screen.includes('restore.isPending'),
  'Purchase and restore actions must expose loading states.'
);
assert(
  profile.includes("router.push('/subscription'") &&
    layout.includes('name="subscription"'),
  'The subscription screen must be reachable from Profile.'
);

console.log('Mobile billing contract validation passed.');
