import { apiRequest } from './client';
import type {
  ConnectHealthRequest,
  DeleteHealthDataRequest,
  DeleteHealthDataResponse,
  DisconnectHealthRequest,
  HealthConnection,
  HealthDailySummaryRequest,
  HealthStatusResponse,
  UpsertHealthDailySummaryResponse
} from '@/types/api';

export function getHealthStatus() {
  return apiRequest<HealthStatusResponse>('/health/status');
}

export function connectHealthProvider(request: ConnectHealthRequest) {
  return apiRequest<HealthConnection>('/health/connect', {
    method: 'POST',
    body: JSON.stringify(request)
  });
}

export function disconnectHealthProvider(request: DisconnectHealthRequest) {
  return apiRequest<HealthConnection>('/health/disconnect', {
    method: 'POST',
    body: JSON.stringify(request)
  });
}

export function deleteHealthData(request: DeleteHealthDataRequest) {
  return apiRequest<DeleteHealthDataResponse>('/health/data', {
    method: 'DELETE',
    body: JSON.stringify(request)
  });
}

export function upsertHealthDailySummary(request: HealthDailySummaryRequest) {
  return apiRequest<UpsertHealthDailySummaryResponse>('/health/daily-summary', {
    method: 'POST',
    body: JSON.stringify(request)
  });
}
