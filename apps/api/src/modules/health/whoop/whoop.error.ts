export type WhoopErrorCode =
  | 'WHOOP_INTEGRATION_DISABLED'
  | 'WHOOP_CONFIG_INVALID'
  | 'WHOOP_OAUTH_STATE_INVALID'
  | 'WHOOP_TOKEN_DECRYPTION_FAILED';

export class WhoopError extends Error {
  constructor(
    public readonly code: WhoopErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'WhoopError';
  }
}
