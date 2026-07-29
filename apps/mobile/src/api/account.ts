import { apiRequest } from './client';
import type {
  BillingReconciliationResponse,
  EntitlementSummary,
  UsageSummary
} from '@/types/api';

export function getEntitlements() {
  return apiRequest<EntitlementSummary>('/me/entitlements');
}

export function getUsageSummary() {
  return apiRequest<UsageSummary>('/me/usage');
}

export function reconcileBilling() {
  return apiRequest<BillingReconciliationResponse>('/me/billing/reconcile', {
    method: 'POST'
  });
}

export function deleteAccount(currentPassword: string) {
  return apiRequest<void>('/me/account', {
    method: 'DELETE',
    body: JSON.stringify({ currentPassword })
  });
}
