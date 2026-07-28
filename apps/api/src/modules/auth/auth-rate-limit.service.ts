import { Injectable } from '@nestjs/common';

interface RateLimitBucket {
  count: number;
  expiresAt: number;
}

@Injectable()
export class AuthRateLimitService {
  private readonly buckets = new Map<string, RateLimitBucket>();
  private operationsSinceCleanup = 0;

  consume(key: string, limit: number, windowSeconds: number, now = Date.now()) {
    this.cleanupOccasionally(now);
    const existing = this.buckets.get(key);

    if (!existing || existing.expiresAt <= now) {
      this.buckets.set(key, {
        count: 1,
        expiresAt: now + windowSeconds * 1000
      });
      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (existing.count >= limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.expiresAt - now) / 1000))
      };
    }

    existing.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  private cleanupOccasionally(now: number) {
    this.operationsSinceCleanup += 1;

    if (this.operationsSinceCleanup < 100) {
      return;
    }

    this.operationsSinceCleanup = 0;

    for (const [key, bucket] of this.buckets) {
      if (bucket.expiresAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}
