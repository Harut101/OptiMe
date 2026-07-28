import { Inject, Injectable } from '@nestjs/common';

import { WHOOP_CONFIG } from './whoop.constants';
import { WhoopError } from './whoop.error';
import { WhoopOAuthStateService } from './whoop-oauth-state.service';
import { WhoopConfig } from './whoop.types';

@Injectable()
export class WhoopOAuthService {
  constructor(
    private readonly states: WhoopOAuthStateService,
    @Inject(WHOOP_CONFIG) private readonly config: WhoopConfig
  ) {}

  async createAuthorizationUrl(userId: string) {
    if (
      !this.config.enabled ||
      !this.config.clientId ||
      !this.config.redirectUri
    ) {
      throw new WhoopError(
        'WHOOP_INTEGRATION_DISABLED',
        'WHOOP integration is disabled.'
      );
    }

    const { state, expiresAt } = await this.states.create(userId);
    const url = new URL(this.config.authUrl);
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('redirect_uri', this.config.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', this.config.scopes.join(' '));
    url.searchParams.set('state', state);

    return {
      authorizationUrl: url.toString(),
      expiresAt
    };
  }

  consumeAuthorizationState(state: string) {
    return this.states.consume(state);
  }
}
