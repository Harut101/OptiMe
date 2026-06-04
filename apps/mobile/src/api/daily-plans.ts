import { apiRequest } from './client';
import type {
  DailyPlanFeedbackResponse,
  DailyPlanResponse,
  SubmitDailyPlanFeedbackRequest
} from '@/types/api';

export function getTodayPlan() {
  return apiRequest<DailyPlanResponse | null>('/daily-plans/today');
}

export function generateTodayPlan(forceRegenerate = false) {
  return apiRequest<DailyPlanResponse>('/daily-plans/generate', {
    method: 'POST',
    body: JSON.stringify({ forceRegenerate })
  });
}

export function getPlanHistory(limit = 10) {
  return apiRequest<{ items: DailyPlanResponse[] }>(`/daily-plans/history?limit=${limit}`);
}

export function submitDailyPlanFeedback(
  dailyPlanId: string,
  feedback: SubmitDailyPlanFeedbackRequest
) {
  return apiRequest<DailyPlanFeedbackResponse>(`/daily-plans/${dailyPlanId}/feedback`, {
    method: 'POST',
    body: JSON.stringify(feedback)
  });
}
