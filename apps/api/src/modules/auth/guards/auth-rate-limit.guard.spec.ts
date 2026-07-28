import { ExecutionContext, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';

import { AuthRateLimitService } from '../auth-rate-limit.service';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';

describe('AuthRateLimitGuard', () => {
  it('returns a safe 429 response without exposing the rate-limit identity', () => {
    const response = { setHeader: jest.fn() };
    const request = {
      ip: '203.0.113.10',
      body: { email: 'private@example.com' }
    };
    const context = {
      getHandler: () => function handler() {},
      getClass: () => class Controller {},
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response
      })
    } as unknown as ExecutionContext;
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue({
        name: 'login',
        windowSeconds: 60,
        ipLimit: 1,
        identityLimit: 1
      })
    } as unknown as Reflector;
    const config = {
      get: jest.fn().mockReturnValue('true')
    } as unknown as ConfigService;
    const guard = new AuthRateLimitGuard(reflector, config, new AuthRateLimitService());

    expect(guard.canActivate(context)).toBe(true);

    try {
      guard.canActivate(context);
      throw new Error('Expected guard to reject the second request.');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
      expect((error as HttpException).getResponse()).toMatchObject({
        code: 'AUTH_RATE_LIMITED'
      });
      expect(JSON.stringify((error as HttpException).getResponse())).not.toContain(
        'private@example.com'
      );
    }

    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  it('can be explicitly disabled for isolated tests', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue({
        name: 'login',
        windowSeconds: 60,
        ipLimit: 1,
        identityLimit: 1
      })
    } as unknown as Reflector;
    const config = {
      get: jest.fn().mockReturnValue('false')
    } as unknown as ConfigService;
    const context = {
      getHandler: () => function handler() {},
      getClass: () => class Controller {}
    } as unknown as ExecutionContext;
    const guard = new AuthRateLimitGuard(reflector, config, new AuthRateLimitService());

    expect(guard.canActivate(context)).toBe(true);
  });
});
