import { apiRequest } from './client';
import type { ProfileRequest } from '@/types/api';

export function saveProfile(body: ProfileRequest) {
  return apiRequest('/profile', {
    method: 'PUT',
    body: JSON.stringify(body)
  });
}
