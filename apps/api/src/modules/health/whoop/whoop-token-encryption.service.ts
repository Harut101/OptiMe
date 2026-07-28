import { Inject, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { WHOOP_CONFIG } from './whoop.constants';
import { WhoopError } from './whoop.error';
import { WhoopConfig } from './whoop.types';

const ALGORITHM = 'aes-256-gcm';
const FORMAT_VERSION = 'v1';

@Injectable()
export class WhoopTokenEncryptionService {
  constructor(@Inject(WHOOP_CONFIG) private readonly config: WhoopConfig) {}

  encrypt(plaintext: string) {
    const key = this.getKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final()
    ]);

    return [
      FORMAT_VERSION,
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      ciphertext.toString('base64url')
    ].join('.');
  }

  decrypt(payload: string) {
    try {
      const [version, ivPart, authTagPart, ciphertextPart, extra] = payload.split('.');

      if (
        version !== FORMAT_VERSION ||
        !ivPart ||
        !authTagPart ||
        !ciphertextPart ||
        extra
      ) {
        throw new Error('Invalid encrypted token format.');
      }

      const decipher = createDecipheriv(
        ALGORITHM,
        this.getKey(),
        Buffer.from(ivPart, 'base64url')
      );
      decipher.setAuthTag(Buffer.from(authTagPart, 'base64url'));

      return Buffer.concat([
        decipher.update(Buffer.from(ciphertextPart, 'base64url')),
        decipher.final()
      ]).toString('utf8');
    } catch (error) {
      if (error instanceof WhoopError) {
        throw error;
      }

      throw new WhoopError(
        'WHOOP_TOKEN_DECRYPTION_FAILED',
        'Stored WHOOP credentials could not be decrypted.'
      );
    }
  }

  private getKey() {
    if (!this.config.enabled || !this.config.tokenEncryptionKey) {
      throw new WhoopError(
        'WHOOP_INTEGRATION_DISABLED',
        'WHOOP integration is disabled.'
      );
    }

    return this.config.tokenEncryptionKey;
  }
}
