import { AuthRateLimitService } from './auth-rate-limit.service';

describe('AuthRateLimitService', () => {
  it('blocks requests above the configured limit until the window resets', () => {
    const service = new AuthRateLimitService();

    expect(service.consume('login:key', 2, 60, 1_000).allowed).toBe(true);
    expect(service.consume('login:key', 2, 60, 2_000).allowed).toBe(true);
    expect(service.consume('login:key', 2, 60, 3_000)).toEqual({
      allowed: false,
      retryAfterSeconds: 58
    });
    expect(service.consume('login:key', 2, 60, 61_001).allowed).toBe(true);
  });

  it('keeps independent identities in separate buckets', () => {
    const service = new AuthRateLimitService();

    service.consume('reset:first', 1, 60, 1_000);

    expect(service.consume('reset:first', 1, 60, 2_000).allowed).toBe(false);
    expect(service.consume('reset:second', 1, 60, 2_000).allowed).toBe(true);
  });
});
