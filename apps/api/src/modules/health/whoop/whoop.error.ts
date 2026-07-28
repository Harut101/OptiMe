export type WhoopErrorCode =
  | 'WHOOP_INTEGRATION_DISABLED'
  | 'WHOOP_CONFIG_INVALID'
  | 'WHOOP_OAUTH_STATE_INVALID'
  | 'WHOOP_TOKEN_DECRYPTION_FAILED'
  | 'WHOOP_AUTHORIZATION_DENIED'
  | 'WHOOP_TOKEN_EXCHANGE_FAILED'
  | 'WHOOP_TOKEN_REFRESH_FAILED'
  | 'WHOOP_TOKEN_RESPONSE_INVALID'
  | 'WHOOP_REQUIRED_SCOPES_MISSING'
  | 'WHOOP_NOT_CONNECTED'
  | 'WHOOP_REAUTH_REQUIRED'
  | 'WHOOP_DATA_REQUEST_FAILED'
  | 'WHOOP_DATA_RESPONSE_INVALID'
  | 'WHOOP_PROVIDER_UNAVAILABLE'
  | 'WHOOP_REVOCATION_FAILED'
  | 'WHOOP_CONNECTION_PERSISTENCE_FAILED';

export class WhoopError extends Error {
  constructor(
    public readonly code: WhoopErrorCode,
    message: string,
    public readonly providerStatus?: number
  ) {
    super(message);
    this.name = 'WhoopError';
  }
}
