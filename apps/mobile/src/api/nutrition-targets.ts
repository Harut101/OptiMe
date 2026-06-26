import { apiRequest } from './client';
import type { NutritionTarget } from '@/types/api';

export function getNutritionTargetPreview(date?: string) {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return apiRequest<NutritionTarget>(`/nutrition-targets/preview${query}`);
}
