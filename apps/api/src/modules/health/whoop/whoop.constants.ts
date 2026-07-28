export const WHOOP_CONFIG = Symbol('WHOOP_CONFIG');
export const WHOOP_HTTP_CLIENT = Symbol('WHOOP_HTTP_CLIENT');

export const WHOOP_DEFAULT_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
export const WHOOP_DEFAULT_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
export const WHOOP_DEFAULT_API_BASE_URL = 'https://api.prod.whoop.com/developer';
export const WHOOP_DEFAULT_STATE_TTL_SECONDS = 600;
export const WHOOP_DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
export const WHOOP_DEFAULT_SCOPES = [
  'offline',
  'read:recovery',
  'read:cycles',
  'read:workout',
  'read:sleep'
] as const;
