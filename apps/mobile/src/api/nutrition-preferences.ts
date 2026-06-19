import { apiRequest } from './client';
import type {
  NutritionPreferencesRequest,
  NutritionPreferencesResponse
} from '@/types/api';

export function getNutritionPreferences() {
  return apiRequest<NutritionPreferencesResponse | null>('/nutrition-preferences');
}

export function saveNutritionPreferences(body: NutritionPreferencesRequest) {
  return apiRequest<NutritionPreferencesResponse>('/nutrition-preferences', {
    method: 'PUT',
    body: JSON.stringify(body)
  });
}
