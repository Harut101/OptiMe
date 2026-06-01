import { apiRequest } from './client';
import type { NutritionPreferencesRequest } from '@/types/api';

export function saveNutritionPreferences(body: NutritionPreferencesRequest) {
  return apiRequest('/nutrition-preferences', {
    method: 'PUT',
    body: JSON.stringify(body)
  });
}
