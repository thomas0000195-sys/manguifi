/**
 * Minimal in-memory fixed-window rate limiter. Good enough for a
 * single-process deployment (the VPS/Docker target this app ships to) —
 * it resets on restart and doesn't share state across instances, so it is
 * NOT appropriate behind a multi-instance/serverless deployment without
 * swapping this for a shared store (Redis, etc.).
 */

const buckets = new Map<string, { count: number; resetAt: number }>();

// Periodically drop expired buckets so this map can't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}, 5 * 60 * 1000).unref?.();

/**
 * Returns true if the action is allowed, false if the key has exceeded
 * `limit` attempts within the current `windowMs` window.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;

  bucket.count += 1;
  return true;
}
