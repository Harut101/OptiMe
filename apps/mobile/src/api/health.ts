import { apiRequest } from './client';
import type {
  ConnectHealthRequest,
  CreateMockWearableSnapshotRequest,
  DeleteHealthDataRequest,
  DeleteHealthDataResponse,
  DisconnectHealthRequest,
  HealthConnectionFoundation,
  HealthConnectionsResponse,
  HealthProvider,
  HealthConnection,
  HealthDailySummaryRequest,
  HealthStatusResponse,
  UpdateHealthConnectionStatusRequest,
  UpsertHealthDailySummaryResponse,
  WearableSnapshotResponse
} from '@/types/api';

export function getHealthStatus() {
  return apiRequest<HealthStatusResponse>('/health/status');
}

export function getHealthConnections() {
  return apiRequest<HealthConnectionsResponse>('/health/connections');
}

export function updateHealthConnectionStatus(
  source: HealthProvider,
  request: UpdateHealthConnectionStatusRequest
) {
  return apiRequest<HealthConnectionFoundation>(`/health/connections/${source}/status`, {
    method: 'PATCH',
    body: JSON.stringify(request)
  });
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

export function getTodayWearableSnapshot() {
  return apiRequest<WearableSnapshotResponse>('/health/wearable-snapshots/today');
}

export function getWearableSnapshot(date: string) {
  return apiRequest<WearableSnapshotResponse>(`/health/wearable-snapshots?date=${encodeURIComponent(date)}`);
}

export function createMockWearableSnapshot(request: CreateMockWearableSnapshotRequest = {}) {
  return apiRequest<WearableSnapshotResponse>('/health/wearable-snapshots/mock', {
    method: 'POST',
    body: JSON.stringify(request)
  });
}
