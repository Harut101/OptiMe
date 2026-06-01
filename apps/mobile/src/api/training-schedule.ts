import { apiRequest } from './client';
import type { TrainingScheduleItem, TrainingScheduleItemRequest } from '@/types/api';

export function getTrainingSchedule() {
  return apiRequest<TrainingScheduleItem[]>('/training-schedule');
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
