interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimiter {
  check(token: string): boolean;
  resetAt(token: string): number;
}

export function createRateLimiter(limit: number, windowMs: number): RateLimiter {
  const buckets = new Map<string, Bucket>();

  return {
    check(token: string): boolean {
      const now = Date.now();
      const bucket = buckets.get(token);
      if (!bucket || now >= bucket.resetAt) {
        buckets.set(token, { count: 1, resetAt: now + windowMs });
        return true;
      }
      if (bucket.count >= limit) {
        return false;
      }
      bucket.count += 1;
      return true;
    },
    resetAt(token: string): number {
      return buckets.get(token)?.resetAt ?? Date.now();
    }
  };
}
