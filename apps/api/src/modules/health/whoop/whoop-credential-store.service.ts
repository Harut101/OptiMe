import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import { WhoopTokenEncryptionService } from './whoop-token-encryption.service';
import { WhoopCredential, WhoopCredentialInput } from './whoop.types';

@Injectable()
export class WhoopCredentialStoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: WhoopTokenEncryptionService
  ) {}

  async save(userId: string, credential: WhoopCredentialInput) {
    const accessTokenCiphertext = this.encryption.encrypt(credential.accessToken);
    const refreshTokenCiphertext = credential.refreshToken
      ? this.encryption.encrypt(credential.refreshToken)
      : null;
    const data = {
      accessTokenCiphertext,
      refreshTokenCiphertext,
      accessTokenExpiresAt: credential.accessTokenExpiresAt ?? null,
      scopes: credential.scopes,
      externalUserId: credential.externalUserId ?? null,
      encryptionVersion: 1
    };

    await this.prisma.whoopOAuthCredential.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        ...data
      }
    });
  }

  async get(userId: string): Promise<WhoopCredential | null> {
    const stored = await this.prisma.whoopOAuthCredential.findUnique({
      where: { userId }
    });

    if (!stored) {
      return null;
    }

    return {
      accessToken: this.encryption.decrypt(stored.accessTokenCiphertext),
      ...(stored.refreshTokenCiphertext
        ? { refreshToken: this.encryption.decrypt(stored.refreshTokenCiphertext) }
        : {}),
      ...(stored.accessTokenExpiresAt
        ? { accessTokenExpiresAt: stored.accessTokenExpiresAt }
        : {}),
      scopes: stored.scopes,
      ...(stored.externalUserId ? { externalUserId: stored.externalUserId } : {})
    };
  }

  async delete(userId: string) {
    await this.prisma.whoopOAuthCredential.deleteMany({ where: { userId } });
  }
}
