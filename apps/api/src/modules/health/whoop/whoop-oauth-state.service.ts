import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';

import { PrismaService } from '../../../prisma/prisma.service';
import { WHOOP_CONFIG } from './whoop.constants';
import { WhoopError } from './whoop.error';
import { WhoopConfig } from './whoop.types';

@Injectable()
export class WhoopOAuthStateService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(WHOOP_CONFIG) private readonly config: WhoopConfig
  ) {}

  async create(userId: string) {
    this.assertEnabled();
    // WHOOP documents an eight-character state requirement for self-generated state.
    const state = randomBytes(6).toString('base64url');
    const expiresAt = new Date(Date.now() + this.config.stateTtlSeconds * 1000);

    await this.prisma.whoopOAuthState.create({
      data: {
        userId,
        stateHash: this.hash(state),
        redirectUri: this.config.redirectUri!,
        expiresAt
      }
    });

    return { state, expiresAt };
  }

  async consume(state: string) {
    this.assertEnabled();
    const stateHash = this.hash(state);
    const record = await this.prisma.whoopOAuthState.findUnique({
      where: { stateHash }
    });

    if (!record || record.consumedAt || record.expiresAt.getTime() <= Date.now()) {
      throw new WhoopError(
        'WHOOP_OAUTH_STATE_INVALID',
        'WHOOP authorization state is invalid, expired, or already used.'
      );
    }

    const consumedAt = new Date();
    const consumed = await this.prisma.whoopOAuthState.updateMany({
      where: {
        id: record.id,
        consumedAt: null,
        expiresAt: { gt: consumedAt }
      },
      data: { consumedAt }
    });

    if (consumed.count !== 1) {
      throw new WhoopError(
        'WHOOP_OAUTH_STATE_INVALID',
        'WHOOP authorization state is invalid, expired, or already used.'
      );
    }

    return {
      userId: record.userId,
      redirectUri: record.redirectUri
    };
  }

  private assertEnabled() {
    if (!this.config.enabled) {
      throw new WhoopError('WHOOP_INTEGRATION_DISABLED', 'WHOOP integration is disabled.');
    }
  }

  private hash(state: string) {
    return createHash('sha256').update(state, 'utf8').digest('hex');
  }
}
