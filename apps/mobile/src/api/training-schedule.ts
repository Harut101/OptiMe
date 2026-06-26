import { apiRequest } from './client';
import type {
  TrainingIntentRequest,
  TrainingScheduleRequest,
  TrainingScheduleResponse,
  TrainingScheduleItem,
  TrainingScheduleItemRequest
} from '@/types/api';

export function getTrainingSchedule() {
  return apiRequest<TrainingScheduleResponse>('/training-schedule');
}

export function saveTrainingSchedule(body: TrainingScheduleRequest) {
  return apiRequest<TrainingScheduleResponse>('/training-schedule', {
    method: 'PUT',
    body: JSON.stringify(body)
  });
}

export function deactivateTrainingSchedule() {
  return apiRequest<TrainingScheduleResponse>('/training-schedule', {
    method: 'DELETE'
  });
}

export function getTrainingScheduleItems() {
  return apiRequest<TrainingScheduleItem[]>('/training-schedule/items');
}

export function createTrainingScheduleItem(body: TrainingScheduleItemRequest) {
  return apiRequest<TrainingScheduleItem>('/training-schedule/items', {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export function updateTrainingScheduleItem(id: string, body: Partial<TrainingScheduleItemRequest>) {
  return apiRequest<TrainingScheduleItem>(`/training-schedule/items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body)
  });
}

export function deleteTrainingScheduleItem(id: string) {
  return apiRequest<{ deleted: boolean }>(`/training-schedule/items/${id}`, {
    method: 'DELETE'
  });
}

export function updateTrainingIntent(body: TrainingIntentRequest) {
  return apiRequest<{ noTrainingPlanned: boolean }>('/training-schedule/intent', {
    method: 'PUT',
    body: JSON.stringify(body)
  });
}
