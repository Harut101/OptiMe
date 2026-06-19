import { apiRequest } from './client';
import type {
  TrainingPreferenceResponse,
  TrainingPreferencesRequest
} from '@/types/api';

export function getTrainingPreferences() {
  return apiRequest<TrainingPreferenceResponse>('/training-preferences');
}

export function saveTrainingPreferences(body: TrainingPreferencesRequest) {
  return apiRequest<TrainingPreferenceResponse>('/training-preferences', {
    method: 'PUT',
    body: JSON.stringify(body)
  });
}
