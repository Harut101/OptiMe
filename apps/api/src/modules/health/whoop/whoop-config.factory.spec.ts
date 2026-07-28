import { ConfigService } from '@nestjs/config';

import {
  WHOOP_DEFAULT_API_BASE_URL,
  WHOOP_DEFAULT_AUTH_URL,
  WHOOP_DEFAULT_STATE_TTL_SECONDS,
  WHOOP_DEFAULT_TOKEN_URL
} from './whoop.constants';
import { createWhoopConfig } from './whoop-config.factory';
import { WhoopError } from './whoop.error';

describe('createWhoopConfig', () => {
  it('defaults to disabled without requiring WHOOP credentials', () => {
    const config = createWhoopConfig(createConfig({}));

    expect(config).toMatchObject({
      enabled: false,
      authUrl: WHOOP_DEFAULT_AUTH_URL,
      tokenUrl: WHOOP_DEFAULT_TOKEN_URL,
      apiBaseUrl: WHOOP_DEFAULT_API_BASE_URL,
      stateTtlSeconds: WHOOP_DEFAULT_STATE_TTL_SECONDS
    });
    expect(config.clientSecret).toBeUndefined();
    expect(config.tokenEncryptionKey).toBeUndefined();
  });

  it('fails fast with a safe error when enabled config is incomplete', () => {
    expect(() =>
      createWhoopConfig(
        createConfig({
          WHOOP_INTEGRATION_ENABLED: 'true',
          WHOOP_CLIENT_ID: 'client-id'
        })
      )
    ).toThrow(
      expect.objectContaining<Partial<WhoopError>>({
        code: 'WHOOP_CONFIG_INVALID'
      })
    );
  });

  it('rejects an ambiguous enabled flag', () => {
    expect(() =>
      createWhoopConfig(
        createConfig({
          WHOOP_INTEGRATION_ENABLED: 'yes'
        })
      )
    ).toThrow(
      'WHOOP_INTEGRATION_ENABLED must be either "true" or "false".'
    );
  });

  it('loads enabled config with a 32-byte encryption key', () => {
    const config = createWhoopConfig(
      createConfig({
        WHOOP_INTEGRATION_ENABLED: 'true',
        WHOOP_CLIENT_ID: 'client-id',
        WHOOP_CLIENT_SECRET: 'client-secret',
        WHOOP_REDIRECT_URI: 'https://api.optime.test/v1/whoop/callback',
        WHOOP_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64')
      })
    );

    expect(config.enabled).toBe(true);
    expect(config.clientId).toBe('client-id');
    expect(config.clientSecret).toBe('client-secret');
    expect(config.tokenEncryptionKey).toEqual(Buffer.alloc(32, 7));
  });

  it('rejects an invalid encryption key without exposing its value', () => {
    const create = () =>
      createWhoopConfig(
        createConfig({
          WHOOP_INTEGRATION_ENABLED: 'true',
          WHOOP_CLIENT_ID: 'client-id',
          WHOOP_CLIENT_SECRET: 'client-secret',
          WHOOP_REDIRECT_URI: 'https://api.optime.test/v1/whoop/callback',
          WHOOP_TOKEN_ENCRYPTION_KEY: 'not-a-secret-key'
        })
      );

    expect(create).toThrow(
      'WHOOP_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.'
    );
    expect(() => create()).not.toThrow('not-a-secret-key');
  });
});

function createConfig(values: Record<string, string>) {
  return new ConfigService(values);
}
