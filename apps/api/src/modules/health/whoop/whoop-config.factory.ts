import { ConfigService } from '@nestjs/config';

import {
  WHOOP_DEFAULT_API_BASE_URL,
  WHOOP_DEFAULT_AUTH_URL,
  WHOOP_DEFAULT_REQUEST_TIMEOUT_MS,
  WHOOP_DEFAULT_SCOPES,
  WHOOP_DEFAULT_STATE_TTL_SECONDS,
  WHOOP_DEFAULT_TOKEN_URL
} from './whoop.constants';
import { WhoopError } from './whoop.error';
import { WhoopConfig } from './whoop.types';

const REQUIRED_ENABLED_KEYS = [
  'WHOOP_CLIENT_ID',
  'WHOOP_CLIENT_SECRET',
  'WHOOP_REDIRECT_URI',
  'WHOOP_TOKEN_ENCRYPTION_KEY'
] as const;

export function createWhoopConfig(configService: ConfigService): WhoopConfig {
  const enabled = parseBoolean(
    configService.get<string>('WHOOP_INTEGRATION_ENABLED', 'false'),
    'WHOOP_INTEGRATION_ENABLED'
  );
  const stateTtlSeconds = parsePositiveInteger(
    configService.get<string>('WHOOP_OAUTH_STATE_TTL_SECONDS'),
    WHOOP_DEFAULT_STATE_TTL_SECONDS,
    'WHOOP_OAUTH_STATE_TTL_SECONDS'
  );
  const requestTimeoutMs = parsePositiveInteger(
    configService.get<string>('WHOOP_REQUEST_TIMEOUT_MS'),
    WHOOP_DEFAULT_REQUEST_TIMEOUT_MS,
    'WHOOP_REQUEST_TIMEOUT_MS'
  );
  const baseConfig = {
    enabled,
    authUrl: readUrl(configService, 'WHOOP_OAUTH_AUTH_URL', WHOOP_DEFAULT_AUTH_URL),
    tokenUrl: readUrl(configService, 'WHOOP_OAUTH_TOKEN_URL', WHOOP_DEFAULT_TOKEN_URL),
    apiBaseUrl: readUrl(configService, 'WHOOP_API_BASE_URL', WHOOP_DEFAULT_API_BASE_URL),
    stateTtlSeconds,
    requestTimeoutMs,
    scopes: [...WHOOP_DEFAULT_SCOPES]
  };

  if (!enabled) {
    return baseConfig;
  }

  const missingKeys = REQUIRED_ENABLED_KEYS.filter(
    (key) => !configService.get<string>(key)?.trim()
  );

  if (missingKeys.length > 0) {
    throw new WhoopError(
      'WHOOP_CONFIG_INVALID',
      `${missingKeys.join(', ')} ${missingKeys.length === 1 ? 'is' : 'are'} required when WHOOP_INTEGRATION_ENABLED=true.`
    );
  }

  const redirectUri = configService.get<string>('WHOOP_REDIRECT_URI')!.trim();
  validateRedirectUri(redirectUri);

  return {
    ...baseConfig,
    clientId: configService.get<string>('WHOOP_CLIENT_ID')!.trim(),
    clientSecret: configService.get<string>('WHOOP_CLIENT_SECRET')!.trim(),
    redirectUri,
    tokenEncryptionKey: decodeEncryptionKey(
      configService.get<string>('WHOOP_TOKEN_ENCRYPTION_KEY')!.trim()
    )
  };
}

function parseBoolean(rawValue: string, key: string) {
  const value = rawValue.trim().toLowerCase();

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw new WhoopError('WHOOP_CONFIG_INVALID', `${key} must be either "true" or "false".`);
}

function readUrl(configService: ConfigService, key: string, fallback: string) {
  const value = configService.get<string>(key, fallback).trim();

  try {
    return new URL(value).toString().replace(/\/$/, '');
  } catch {
    throw new WhoopError('WHOOP_CONFIG_INVALID', `${key} must be a valid URL.`);
  }
}

function validateRedirectUri(value: string) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new WhoopError('WHOOP_CONFIG_INVALID', 'WHOOP_REDIRECT_URI must be a valid URL.');
  }

  const isLocalHttp =
    url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');

  if (url.protocol !== 'https:' && !isLocalHttp) {
    throw new WhoopError(
      'WHOOP_CONFIG_INVALID',
      'WHOOP_REDIRECT_URI must use HTTPS, except for localhost development.'
    );
  }
}

function parsePositiveInteger(rawValue: string | undefined, fallback: number, key: string) {
  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value <= 0) {
    throw new WhoopError('WHOOP_CONFIG_INVALID', `${key} must be a positive integer.`);
  }

  return value;
}

function decodeEncryptionKey(value: string) {
  const base64Pattern = /^[A-Za-z0-9+/]{43}=$|^[A-Za-z0-9+/]{42}==$|^[A-Za-z0-9+/]{44}$/;

  if (!base64Pattern.test(value)) {
    throw new WhoopError(
      'WHOOP_CONFIG_INVALID',
      'WHOOP_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.'
    );
  }

  const key = Buffer.from(value, 'base64');

  if (key.length !== 32) {
    throw new WhoopError(
      'WHOOP_CONFIG_INVALID',
      'WHOOP_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.'
    );
  }

  return key;
}
