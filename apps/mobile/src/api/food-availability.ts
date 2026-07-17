import { apiRequest } from './client';
import type {
  FoodAvailabilityCandidatesResponse,
  FoodAvailabilityResponse
} from '@/types/api';

export function getTodayFoodAvailability() {
  return apiRequest<FoodAvailabilityResponse>('/food-availability/today');
}

export function getTodayFoodAvailabilityCandidates() {
  return apiRequest<FoodAvailabilityCandidatesResponse>('/food-availability/candidates');
}

export function replaceTodayFoodAvailability(catalogFoodSlugs: string[]) {
  return apiRequest<FoodAvailabilityResponse>('/food-availability/today', {
    method: 'PUT',
    body: JSON.stringify({ catalogFoodSlugs })
  });
}
