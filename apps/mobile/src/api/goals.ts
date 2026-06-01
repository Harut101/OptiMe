import { apiRequest } from './client';
import type { GoalRequest } from '@/types/api';

export function saveGoal(body: GoalRequest) {
  return apiRequest('/goals', {
    method: 'PUT',
    body: JSON.stringify(body)
  });
}
