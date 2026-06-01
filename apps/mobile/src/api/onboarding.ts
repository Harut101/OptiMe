import { apiRequest } from './client';
import type { OnboardingStatus } from '@/types/api';

export function getOnboardingStatus() {
  return apiRequest<OnboardingStatus>('/onboarding/status');
}
