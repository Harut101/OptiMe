import { Inject, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

import { WHOOP_CONFIG, WHOOP_HTTP_CLIENT } from './whoop.constants';
import { WhoopError } from './whoop.error';
import { WhoopConfig, WhoopHttpClient, WhoopTokenResponse } from './whoop.types';

const tokenResponseSchema = z.object({
  access_token: z.string().min(1).max(8192),
  refresh_token: z.string().min(1).max(8192),
  expires_in: z.number().int().positive().max(31_536_000),
  scope: z.string().min(1).max(4096),
  token_type: z
    .string()
    .max(32)
    .transform((value) => value.toLowerCase())
});

@Injectable()
export class WhoopOAuthClientService {
  private readonly logger = new Logger(WhoopOAuthClientService.name);

  constructor(
    @Inject(WHOOP_CONFIG) private readonly config: WhoopConfig,
    @Inject(WHOOP_HTTP_CLIENT) private readonly httpClient: WhoopHttpClient
  ) {}

  async exchangeAuthorizationCode(code: string, redirectUri: string): Promise<WhoopTokenResponse> {
    this.assertEnabled();
    this.logger.log('WHOOP token exchange started');

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: this.config.clientId!,
      client_secret: this.config.clientSecret!,
      redirect_uri: redirectUri
    });
    const response = await this.request(
      this.config.tokenUrl,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString()
      },
      'token_exchange'
    );

    if (!response.ok) {
      this.logger.warn(`WHOOP token exchange failed; status=${response.status}`);
      throw new WhoopError(
        response.status >= 500 || response.status === 429
          ? 'WHOOP_PROVIDER_UNAVAILABLE'
          : 'WHOOP_TOKEN_EXCHANGE_FAILED',
        'WHOOP authorization could not be completed.',
        response.status
      );
    }

    const token = await this.parseTokenResponse(response);

    if (token.missingScopes.length > 0) {
      this.logger.warn(`WHOOP required scopes missing; missingCount=${token.missingScopes.length}`);
      try {
        await this.revokeAccess(token.response.accessToken);
      } catch {
        this.logger.warn('WHOOP incomplete authorization could not be revoked immediately');
      }
      throw new WhoopError(
        'WHOOP_REQUIRED_SCOPES_MISSING',
        'WHOOP authorization did not grant all required permissions.'
      );
    }

    this.logger.log('WHOOP token exchange completed');
    return token.response;
  }

  async refreshAccessToken(refreshToken: string): Promise<WhoopTokenResponse> {
    this.assertEnabled();
    this.logger.log('WHOOP token refresh started');

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.clientId!,
      client_secret: this.config.clientSecret!,
      scope: 'offline'
    });
    const response = await this.request(
      this.config.tokenUrl,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString()
      },
      'token_refresh'
    );

    if (!response.ok) {
      this.logger.warn(`WHOOP token refresh failed; status=${response.status}`);
      throw new WhoopError(
        response.status === 400 || response.status === 401
          ? 'WHOOP_REAUTH_REQUIRED'
          : response.status >= 500 || response.status === 429
            ? 'WHOOP_PROVIDER_UNAVAILABLE'
            : 'WHOOP_TOKEN_REFRESH_FAILED',
        response.status === 400 || response.status === 401
          ? 'WHOOP authorization needs to be renewed.'
          : 'WHOOP access could not be refreshed.',
        response.status
      );
    }

    const token = await this.parseTokenResponse(response);

    if (token.missingScopes.length > 0) {
      this.logger.warn(
        `WHOOP refreshed token scopes missing; missingCount=${token.missingScopes.length}`
      );
      throw new WhoopError(
        'WHOOP_REQUIRED_SCOPES_MISSING',
        'WHOOP authorization no longer grants all required permissions.'
      );
    }

    this.logger.log('WHOOP token refresh completed');
    return token.response;
  }

  async revokeAccess(accessToken: string) {
    this.assertEnabled();
    this.logger.log('WHOOP access revocation started');
    const response = await this.request(
      `${this.config.apiBaseUrl}/v2/user/access`,
      {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`
        }
      },
      'access_revocation'
    );

    if (response.status === 204) {
      this.logger.log('WHOOP access revocation completed');
      return true;
    }

    if (response.status === 401) {
      this.logger.log('WHOOP access was already invalid');
      return true;
    }

    this.logger.warn(`WHOOP access revocation failed; status=${response.status}`);
    throw new WhoopError(
      response.status >= 500 || response.status === 429
        ? 'WHOOP_PROVIDER_UNAVAILABLE'
        : 'WHOOP_REVOCATION_FAILED',
      'WHOOP access could not be revoked at the provider.',
      response.status
    );
  }

  private async request(
    url: string,
    init: RequestInit,
    stage: 'token_exchange' | 'token_refresh' | 'access_revocation'
  ) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

    try {
      return await this.httpClient.fetch(url, {
        ...init,
        signal: controller.signal
      });
    } catch (error) {
      const timedOut =
        controller.signal.aborted || (error instanceof Error && error.name === 'AbortError');
      this.logger.warn(
        `WHOOP request failed; stage=${stage}; reason=${timedOut ? 'timeout' : 'network_error'}`
      );
      throw new WhoopError(
        'WHOOP_PROVIDER_UNAVAILABLE',
        timedOut ? 'WHOOP request timed out.' : 'WHOOP is temporarily unavailable.'
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async parseTokenResponse(response: Response) {
    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      throw new WhoopError(
        'WHOOP_TOKEN_RESPONSE_INVALID',
        'WHOOP returned an invalid token response.'
      );
    }

    const parsed = tokenResponseSchema.safeParse(payload);

    if (!parsed.success || parsed.data.token_type !== 'bearer') {
      throw new WhoopError(
        'WHOOP_TOKEN_RESPONSE_INVALID',
        'WHOOP returned an invalid token response.'
      );
    }

    const scopes = parsed.data.scope.split(/\s+/).filter(Boolean);

    return {
      response: {
        accessToken: parsed.data.access_token,
        refreshToken: parsed.data.refresh_token,
        expiresInSeconds: parsed.data.expires_in,
        scopes,
        tokenType: 'bearer' as const
      },
      missingScopes: this.config.scopes.filter((scope) => !scopes.includes(scope))
    };
  }

  private assertEnabled() {
    if (!this.config.enabled || !this.config.clientId || !this.config.clientSecret) {
      throw new WhoopError('WHOOP_INTEGRATION_DISABLED', 'WHOOP integration is disabled.');
    }
  }
}
