import { Injectable, Logger } from '@nestjs/common';
import { HealthConnectionStatus, HealthProvider } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { WhoopCredentialStoreService } from './whoop-credential-store.service';
import { WhoopError } from './whoop.error';
import { WhoopOAuthClientService } from './whoop-oauth-client.service';

const REFRESH_EARLY_MS = 60_000;

@Injectable()
export class WhoopAccessTokenService {
  private readonly logger = new Logger(WhoopAccessTokenService.name);
  private readonly refreshes = new Map<string, Promise<string>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: WhoopCredentialStoreService,
    private readonly oauthClient: WhoopOAuthClientService
  ) {}

  async getAccessToken(userId: string, forceRefresh = false) {
    const credential = await this.credentials.get(userId);

    if (!credential) {
      throw new WhoopError('WHOOP_NOT_CONNECTED', 'WHOOP is not connected.');
    }

    const expiresSoon =
      !credential.accessTokenExpiresAt
      || credential.accessTokenExpiresAt.getTime() <= Date.now() + REFRESH_EARLY_MS;

    if (!forceRefresh && !expiresSoon) {
      return { accessToken: credential.accessToken, refreshed: false };
    }

    if (!credential.refreshToken) {
      await this.markConnection(userId, HealthConnectionStatus.NEEDS_REAUTH, 'WHOOP_REAUTH_REQUIRED');
      throw new WhoopError('WHOOP_REAUTH_REQUIRED', 'WHOOP authorization needs to be renewed.');
    }

    const existing = this.refreshes.get(userId);

    if (existing) {
      return { accessToken: await existing, refreshed: true };
    }

    const refresh = this.rotate(userId, credential.refreshToken, credential.externalUserId);
    this.refreshes.set(userId, refresh);

    try {
      return { accessToken: await refresh, refreshed: true };
    } finally {
      this.refreshes.delete(userId);
    }
  }

  private async rotate(userId: string, refreshToken: string, externalUserId?: string) {
    try {
      const token = await this.oauthClient.refreshAccessToken(refreshToken);
      await this.credentials.rotate(userId, {
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        accessTokenExpiresAt: new Date(Date.now() + token.expiresInSeconds * 1000),
        scopes: token.scopes,
        ...(externalUserId ? { externalUserId } : {})
      });
      await this.markConnection(userId, HealthConnectionStatus.CONNECTED, null);
      this.logger.log('WHOOP credential rotation persisted');
      return token.accessToken;
    } catch (error) {
      const code = error instanceof WhoopError ? error.code : 'WHOOP_TOKEN_REFRESH_FAILED';
      const status =
        code === 'WHOOP_REAUTH_REQUIRED' || code === 'WHOOP_REQUIRED_SCOPES_MISSING'
          ? HealthConnectionStatus.NEEDS_REAUTH
          : HealthConnectionStatus.ERROR;
      await this.markConnection(userId, status, code);
      throw error;
    }
  }

  private async markConnection(
    userId: string,
    status: HealthConnectionStatus,
    errorReason: string | null
  ) {
    await this.prisma.healthConnection.upsert({
      where: { userId_provider: { userId, provider: HealthProvider.WHOOP } },
      update: { status, errorReason },
      create: { userId, provider: HealthProvider.WHOOP, status, errorReason }
    });
  }
}
