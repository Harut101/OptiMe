import { Injectable } from '@nestjs/common';
import { HealthConnectionStatus, HealthProvider } from '@prisma/client';

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
    const data = this.encrypt(credential);

    await this.prisma.whoopOAuthCredential.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        ...data
      }
    });
  }

  async saveAndMarkConnected(userId: string, credential: WhoopCredentialInput) {
    const data = this.encrypt(credential);
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.whoopOAuthCredential.upsert({
        where: { userId },
        update: data,
        create: {
          userId,
          ...data
        }
      }),
      this.prisma.healthConnection.upsert({
        where: {
          userId_provider: {
            userId,
            provider: HealthProvider.WHOOP
          }
        },
        update: {
          status: HealthConnectionStatus.CONNECTED,
          consentedAt: now,
          disconnectedAt: null,
          permissionsGranted: { scopes: credential.scopes },
          errorReason: null
        },
        create: {
          userId,
          provider: HealthProvider.WHOOP,
          status: HealthConnectionStatus.CONNECTED,
          consentedAt: now,
          permissionsGranted: { scopes: credential.scopes }
        }
      })
    ]);
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
        ? {
            refreshToken: this.encryption.decrypt(stored.refreshTokenCiphertext)
          }
        : {}),
      ...(stored.accessTokenExpiresAt ? { accessTokenExpiresAt: stored.accessTokenExpiresAt } : {}),
      scopes: stored.scopes,
      ...(stored.externalUserId ? { externalUserId: stored.externalUserId } : {})
    };
  }

  async exists(userId: string) {
    return Boolean(
      await this.prisma.whoopOAuthCredential.findUnique({
        where: { userId },
        select: { id: true }
      })
    );
  }

  async delete(userId: string) {
    await this.prisma.whoopOAuthCredential.deleteMany({ where: { userId } });
  }

  async deleteAndMarkDisconnected(userId: string) {
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.whoopOAuthCredential.deleteMany({ where: { userId } }),
      this.prisma.healthConnection.upsert({
        where: {
          userId_provider: {
            userId,
            provider: HealthProvider.WHOOP
          }
        },
        update: {
          status: HealthConnectionStatus.DISCONNECTED,
          disconnectedAt: now,
          errorReason: null
        },
        create: {
          userId,
          provider: HealthProvider.WHOOP,
          status: HealthConnectionStatus.DISCONNECTED,
          disconnectedAt: now
        }
      })
    ]);
  }

  private encrypt(credential: WhoopCredentialInput) {
    return {
      accessTokenCiphertext: this.encryption.encrypt(credential.accessToken),
      refreshTokenCiphertext: credential.refreshToken
        ? this.encryption.encrypt(credential.refreshToken)
        : null,
      accessTokenExpiresAt: credential.accessTokenExpiresAt ?? null,
      scopes: credential.scopes,
      externalUserId: credential.externalUserId ?? null,
      encryptionVersion: 1
    };
  }
}
