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
  scopes: string[];
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
