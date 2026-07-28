import { WhoopError } from './whoop.error';
import { WhoopTokenEncryptionService } from './whoop-token-encryption.service';
import { WhoopConfig } from './whoop.types';

describe('WhoopTokenEncryptionService', () => {
  const config: WhoopConfig = {
    enabled: true,
    tokenEncryptionKey: Buffer.alloc(32, 9),
    authUrl: 'https://example.test/auth',
    tokenUrl: 'https://example.test/token',
    apiBaseUrl: 'https://example.test/api',
    stateTtlSeconds: 600,
    scopes: []
  };

  it('encrypts and decrypts a token without persisting plaintext', () => {
    const service = new WhoopTokenEncryptionService(config);
    const encrypted = service.encrypt('private-access-token');

    expect(encrypted).not.toContain('private-access-token');
    expect(encrypted.startsWith('v1.')).toBe(true);
    expect(service.decrypt(encrypted)).toBe('private-access-token');
  });

  it('rejects a tampered ciphertext with a typed safe error', () => {
    const service = new WhoopTokenEncryptionService(config);
    const encrypted = service.encrypt('private-access-token');
    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith('A') ? 'B' : 'A'}`;

    expect(() => service.decrypt(tampered)).toThrow(
      expect.objectContaining<Partial<WhoopError>>({
        code: 'WHOOP_TOKEN_DECRYPTION_FAILED'
      })
    );
  });

  it('does not allow token operations while WHOOP is disabled', () => {
    const service = new WhoopTokenEncryptionService({
      ...config,
      enabled: false,
      tokenEncryptionKey: undefined
    });

    expect(() => service.encrypt('token')).toThrow(
      expect.objectContaining<Partial<WhoopError>>({
        code: 'WHOOP_INTEGRATION_DISABLED'
      })
    );
  });
});
