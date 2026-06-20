import { apiRequest } from './client';
import type { UpdateUserSettingsRequest, UserSettingsResponse } from '@/types/api';

export function getSettings() {
  return apiRequest<UserSettingsResponse>('/settings');
}

export function updateSettings(body: UpdateUserSettingsRequest) {
  return apiRequest<UserSettingsResponse>('/settings', {
    method: 'PUT',
    body: JSON.stringify(body)
  });
}
