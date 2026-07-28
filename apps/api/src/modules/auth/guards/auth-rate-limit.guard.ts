import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';

import { parseBoolean } from '../../../config/environment.validation';
import {
  AUTH_RATE_LIMIT,
  AuthRateLimitOptions
} from '../auth-rate-limit.decorator';
import { AuthRateLimitService } from '../auth-rate-limit.service';

interface AuthRequest {
  body?: { email?: unknown };
  ip?: string;
  socket?: { remoteAddress?: string };
}

interface AuthResponse {
  setHeader(name: string, value: string): void;
}

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly rateLimits: AuthRateLimitService
  ) {}

  canActivate(context: ExecutionContext) {
    const options = this.reflector.getAllAndOverride<AuthRateLimitOptions>(
      AUTH_RATE_LIMIT,
      [context.getHandler(), context.getClass()]
    );

    if (!options || !parseBoolean(this.config.get('AUTH_RATE_LIMIT_ENABLED'), 'AUTH_RATE_LIMIT_ENABLED')) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthRequest>();
    const response = context.switchToHttp().getResponse<AuthResponse>();
    const ip = request.ip ?? request.socket?.remoteAddress ?? 'unknown';
    const email =
      typeof request.body?.email === 'string'
        ? request.body.email.trim().toLowerCase()
        : 'unknown';
    const ipResult = this.rateLimits.consume(
      `${options.name}:ip:${this.digest(ip)}`,
      options.ipLimit,
      options.windowSeconds
    );
    const identityResult = this.rateLimits.consume(
      `${options.name}:identity:${this.digest(email)}`,
      options.identityLimit,
      options.windowSeconds
    );

    if (ipResult.allowed && identityResult.allowed) {
      return true;
    }

    const retryAfterSeconds = Math.max(
      ipResult.retryAfterSeconds,
      identityResult.retryAfterSeconds
    );
    response.setHeader('Retry-After', String(retryAfterSeconds));

    throw new HttpException(
      {
        code: 'AUTH_RATE_LIMITED',
        message: 'Too many attempts. Please wait before trying again.',
        retryAfterSeconds
      },
      HttpStatus.TOO_MANY_REQUESTS
    );
  }

  private digest(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
}
