import { API_BASE_URL } from '@/config/env';
import { useAuthStore } from '@/store/auth-store';
import { useSettingsStore } from '@/store/settings-store';
import { resolveSupportedLocale } from '@optime/shared-types';
import { i18n } from '@/i18n';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown
  ) {
    super(message);
  }
}

interface ApiOptions extends RequestInit {
  auth?: boolean;
}

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const headers = new Headers(options.headers);

  headers.set('Accept', 'application/json');
  headers.set(
    'Accept-Language',
    resolveSupportedLocale(useSettingsStore.getState().preferredLocale)
  );

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.auth !== false && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const message =
      typeof errorBody?.message === 'string'
        ? errorBody.message
        : Array.isArray(errorBody?.message)
          ? errorBody.message.join('\n')
          : i18n.t('errors.network');

    throw new ApiError(message, response.status, errorBody);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();

  if (!text) {
    return null as T;
  }

  return JSON.parse(text) as T;
}
