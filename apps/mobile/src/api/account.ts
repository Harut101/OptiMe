import { apiRequest } from './client';
import type { EntitlementSummary, UsageSummary } from '@/types/api';

export function getEntitlements() {
  return apiRequest<EntitlementSummary>('/me/entitlements');
}

export function getUsageSummary() {
  return apiRequest<UsageSummary>('/me/usage');
}

export function deleteAccount(currentPassword: string) {
  return apiRequest<void>('/me/account', {
    method: 'DELETE',
    body: JSON.stringify({ currentPassword })
  });
}
