/**
 * Simple fixed-window rate limiter (in-memory).
 * Suitable for a single Node process / one Docker replica.
 */

export type RateLimitResult =
  | { ok: true; remaining: number; limit: number }
  | { ok: false; remaining: 0; limit: number; retryAfterSec: number };

type Bucket = {
  count: number;
  /** Window start (ms) */
  windowStart: number;
};

/** Exposed for tests; production code uses the default store. */
export function createRateLimitStore() {
  const buckets = new Map<string, Bucket>();

  function check(
    key: string,
    limit: number,
    windowMs: number,
    now = Date.now()
  ): RateLimitResult {
    if (limit <= 0 || windowMs <= 0) {
      return { ok: true, remaining: 0, limit };
    }

    const existing = buckets.get(key);
    if (!existing || now - existing.windowStart >= windowMs) {
      buckets.set(key, { count: 1, windowStart: now });
      return { ok: true, remaining: Math.max(0, limit - 1), limit };
    }

    if (existing.count >= limit) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((existing.windowStart + windowMs - now) / 1000)
      );
      return { ok: false, remaining: 0, limit, retryAfterSec };
    }

    existing.count += 1;
    return { ok: true, remaining: Math.max(0, limit - existing.count), limit };
  }

  function reset() {
    buckets.clear();
  }

  /** Test helper: number of tracked keys. */
  function size() {
    return buckets.size;
  }

  return { check, reset, size };
}

const defaultStore = createRateLimitStore();

/**
 * Consume one attempt for `key` within `windowMs`.
 * Keys should include the action and identity, e.g. `login:ip:1.2.3.4`.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now?: number
): RateLimitResult {
  return defaultStore.check(key, limit, windowMs, now);
}

/** Clear all buckets (tests only). */
export function resetRateLimitsForTests() {
  defaultStore.reset();
}
