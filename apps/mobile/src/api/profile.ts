import { apiRequest } from './client';
import type { ProfileRequest, ProfileResponse } from '@/types/api';

export function getProfile() {
  return apiRequest<ProfileResponse>('/profile');
}

export function saveProfile(body: ProfileRequest) {
  return apiRequest<ProfileResponse>('/profile', {
    method: 'PUT',
    body: JSON.stringify(body)
  });
}
