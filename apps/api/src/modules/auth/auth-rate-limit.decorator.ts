import { SetMetadata } from '@nestjs/common';

export const AUTH_RATE_LIMIT = 'auth-rate-limit';

export interface AuthRateLimitOptions {
  name: string;
  windowSeconds: number;
  ipLimit: number;
  identityLimit: number;
}

export const AuthRateLimit = (options: AuthRateLimitOptions) =>
  SetMetadata(AUTH_RATE_LIMIT, options);
