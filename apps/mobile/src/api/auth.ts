import { apiRequest } from './client';
import type { AuthResponse, UserDto } from '@/types/api';

export function registerUser(body: {
  email: string;
  password: string;
  timezone?: string;
  locale?: string;
  privacyConsentAccepted?: boolean;
}) {
  return apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    auth: false,
    body: JSON.stringify(body)
  });
}

export function loginUser(body: { email: string; password: string }) {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    auth: false,
    body: JSON.stringify(body)
  });
}

export function getMe() {
  return apiRequest<UserDto>('/me');
}
