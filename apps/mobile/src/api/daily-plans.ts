import { apiRequest } from './client';
import type { DailyPlanResponse } from '@/types/api';

export function getTodayPlan() {
  return apiRequest<DailyPlanResponse | null>('/daily-plans/today');
}

export function generateTodayPlan(forceRegenerate = false) {
  return apiRequest<DailyPlanResponse>('/daily-plans/generate', {
    method: 'POST',
    body: JSON.stringify({ forceRegenerate })
  });
}
