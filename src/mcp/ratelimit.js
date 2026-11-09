// A token bucket per caller. Each caller has room for `burst` requests at once, refilled at `perMinute` requests a
// minute. A caller over the limit gets a refusal with the number of seconds until the next request is allowed.
// The clock is injectable, so the tests need no waiting.

export function createRateLimiter({ perMinute = 120, burst = 30, now = () => Date.now(), maxCallers = 10000 } = {}) {
  if (!Number.isFinite(perMinute) || perMinute <= 0) throw new RangeError("perMinute must be a positive number");
  if (!Number.isFinite(burst) || burst < 1) throw new RangeError("burst must be at least 1");
  const rate = perMinute / 60000; // tokens per millisecond
  const buckets = new Map();

  return {
    // Takes one token for the caller. Returns { allowed: true } or { allowed: false, retryAfter: seconds }.
    take(caller) {
      const t = now();
      let b = buckets.get(caller);
      if (!b) {
        // A flood of distinct callers must not grow memory without limit: forget the oldest callers first.
        if (buckets.size >= maxCallers) buckets.delete(buckets.keys().next().value);
        b = { tokens: burst, at: t };
        buckets.set(caller, b);
      }
      b.tokens = Math.min(burst, b.tokens + (t - b.at) * rate);
      b.at = t;
      if (b.tokens >= 1) {
        b.tokens -= 1;
        return { allowed: true };
      }
      return { allowed: false, retryAfter: Math.ceil((1 - b.tokens) / rate / 1000) };
    },
    size: () => buckets.size,
  };
}
