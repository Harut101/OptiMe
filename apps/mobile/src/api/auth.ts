import { apiRequest } from './client';
import type {
  AuthMessageResponse,
  AuthResponse,
  RegistrationResponse,
  UserDto
} from '@/types/api';

export function registerUser(body: {
  email: string;
  password: string;
  timezone?: string;
  locale?: string;
  privacyConsentAccepted?: boolean;
}) {
  return apiRequest<RegistrationResponse>('/auth/register', {
    method: 'POST',
    auth: false,
    body: JSON.stringify(body)
  });
}

export function verifyEmail(body: { email: string; code: string }) {
  return apiRequest<AuthResponse>('/auth/verify-email', {
    method: 'POST',
    auth: false,
    body: JSON.stringify(body)
  });
}

export function resendVerification(body: { email: string }) {
  return apiRequest<AuthMessageResponse>('/auth/resend-verification', {
    method: 'POST',
    auth: false,
    body: JSON.stringify(body)
  });
}

export function requestPasswordReset(body: { email: string }) {
  return apiRequest<AuthMessageResponse>('/auth/request-password-reset', {
    method: 'POST',
    auth: false,
    body: JSON.stringify(body)
  });
}

export function resetPassword(body: { email: string; code: string; newPassword: string }) {
  return apiRequest<AuthMessageResponse>('/auth/reset-password', {
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
