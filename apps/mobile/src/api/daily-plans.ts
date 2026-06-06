import { apiRequest } from './client';
import type {
  CreateDailyPlanCheckInRequest,
  DailyPlanCheckInsResponse,
  DailyPlanCheckInResponse,
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

export function getDailyPlanCheckIns(dailyPlanId: string) {
  return apiRequest<DailyPlanCheckInsResponse>(`/daily-plans/${dailyPlanId}/check-ins`);
}

export function submitDailyPlanCheckIn(
  dailyPlanId: string,
  checkIn: CreateDailyPlanCheckInRequest
) {
  return apiRequest<DailyPlanCheckInResponse>(`/daily-plans/${dailyPlanId}/check-ins`, {
    method: 'POST',
    body: JSON.stringify(checkIn)
  });
}
