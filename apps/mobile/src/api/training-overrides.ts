import { apiRequest } from './client';
import type {
  DailyTrainingOverrideRequest,
  DailyTrainingOverrideResponse,
  MoveWorkoutResponse
} from '@/types/api';

export function getTrainingOverride(localDate: string) {
  return apiRequest<{ override: DailyTrainingOverrideResponse | null }>(`/training-overrides?date=${encodeURIComponent(localDate)}`)
    .then((response) => response.override);
}

export function saveTrainingOverride(localDate: string, body: DailyTrainingOverrideRequest) {
  return apiRequest<DailyTrainingOverrideResponse>(`/training-overrides/${encodeURIComponent(localDate)}`, {
    method: 'PUT',
    body: JSON.stringify(body)
  });
}

export function deleteTrainingOverride(localDate: string) {
  return apiRequest<{ deleted: boolean }>(`/training-overrides/${encodeURIComponent(localDate)}`, {
    method: 'DELETE'
  });
}

export function moveWorkout(body: {
  fromLocalDate: string;
  toLocalDate: string;
  timezone?: string;
}) {
  return apiRequest<MoveWorkoutResponse>('/training-overrides/move-workout', {
    method: 'POST',
    body: JSON.stringify(body)
  });
}
