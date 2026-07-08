import { apiRequest } from './client';
import type { CreateWeightLogRequest, WeightLogResponse, WeightLogsResponse, WeightSummary } from '@/types/api';

export function getWeightSummary() {
  return apiRequest<WeightSummary>('/weight/summary');
}

export function getWeightLogs(limit = 10) {
  return apiRequest<WeightLogsResponse>(`/weight/logs?limit=${encodeURIComponent(String(limit))}`);
}

export function createWeightLog(request: CreateWeightLogRequest) {
  return apiRequest<WeightLogResponse>('/weight/logs', {
    method: 'POST',
    body: JSON.stringify(request)
  });
}
