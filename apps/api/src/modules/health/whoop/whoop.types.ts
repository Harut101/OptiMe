export interface WhoopConfig {
  enabled: boolean;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  tokenEncryptionKey?: Buffer;
  authUrl: string;
  tokenUrl: string;
  apiBaseUrl: string;
  stateTtlSeconds: number;
  requestTimeoutMs: number;
  scopes: string[];
}

export interface WhoopHttpClient {
  fetch(input: string | URL, init?: RequestInit): Promise<Response>;
}

export interface WhoopTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  scopes: string[];
  tokenType: 'bearer';
}

export interface WhoopCredentialInput {
  accessToken: string;
  refreshToken?: string;
  accessTokenExpiresAt?: Date;
  scopes: string[];
  externalUserId?: string;
}

export interface WhoopCredential {
  accessToken: string;
  refreshToken?: string;
  accessTokenExpiresAt?: Date;
  scopes: string[];
  externalUserId?: string;
}

export interface WhoopAuthorizationCallback {
  state: string;
  code?: string;
  error?: string;
}
