import { apiRequest } from './client';
import type { GoalRequest, GoalResponse } from '@/types/api';

export function getGoal() {
  return apiRequest<GoalResponse | null>('/goals');
}

export function saveGoal(body: GoalRequest) {
  return apiRequest<GoalResponse>('/goals', {
    method: 'PUT',
    body: JSON.stringify(body)
  });
}
