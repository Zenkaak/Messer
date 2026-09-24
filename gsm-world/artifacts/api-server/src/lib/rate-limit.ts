/**
 * In-memory sliding-window rate limiter.
 *
 * Zero DB queries — all state is kept in a process-local Map.
 * This replaces the previous DB-backed implementation, which caused a DB
 * round-trip for every request — exactly the wrong approach under high load.
 *
 * Trade-off: state is not shared across cluster workers. Each worker has its
 * own window, so the effective limit is (max * WORKERS) per IP cluster-wide.
 * That is acceptable — the goal is protecting DB and AI APIs from abuse, not
 * enforcing a perfectly precise global cap.
 *
 * Memory: each unique key costs ~200 bytes. 100k unique IPs ≈ 20 MB — trivial.
 * Stale entries are pruned lazily on every access + a periodic sweep.
 */

interface Window {
  hits: number[];   // timestamps (ms) of recent requests
}

const _store = new Map<string, Window>();

/** Prune hits older than windowMs from a window. */
function _prune(w: Window, windowMs: number): void {
  const cutoff = Date.now() - windowMs;
  let i = 0;
  while (i < w.hits.length && w.hits[i] < cutoff) i++;
  if (i > 0) w.hits.splice(0, i);
}

/**
 * Check whether the key is currently rate-limited.
 * Returns { blocked: false } if allowed, or { blocked: true, retryAfterSec }
 * if the window is full. Does NOT record the hit — call recordRateLimitAttempt
 * separately so the old call sites continue to work unchanged.
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<{ blocked: boolean; retryAfterSec?: number }> {
  const w = _store.get(key);
  if (!w || w.hits.length === 0) return { blocked: false };
  _prune(w, windowMs);
  if (w.hits.length < max) return { blocked: false };
  const oldest = w.hits[0];
  const retryAfterSec = Math.ceil((oldest + windowMs - Date.now()) / 1000);
  return { blocked: true, retryAfterSec: Math.max(1, retryAfterSec) };
}

/** Record one hit for key. Must be called AFTER checkRateLimit allows it. */
export async function recordRateLimitAttempt(
  key: string,
  windowMs: number,
): Promise<void> {
  let w = _store.get(key);
  if (!w) { w = { hits: [] }; _store.set(key, w); }
  _prune(w, windowMs);
  w.hits.push(Date.now());
}

/** Remove all hits for key (e.g. after successful login). */
export async function clearRateLimit(key: string): Promise<void> {
  _store.delete(key);
}

/**
 * Synchronous combined check-and-record in one call.
 * More efficient for high-throughput paths (bot endpoint, etc.)
 * Returns { blocked: false } and records the hit if allowed.
 */
export function checkAndRecordSync(
  key: string,
  max: number,
  windowMs: number,
): { blocked: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const cutoff = now - windowMs;
  let w = _store.get(key);
  if (!w) { w = { hits: [] }; _store.set(key, w); }

  // Prune expired hits
  let i = 0;
  while (i < w.hits.length && w.hits[i] < cutoff) i++;
  if (i > 0) w.hits.splice(0, i);

  if (w.hits.length >= max) {
    const retryAfterSec = Math.max(1, Math.ceil((w.hits[0] + windowMs - now) / 1000));
    return { blocked: true, retryAfterSec };
  }
  w.hits.push(now);
  return { blocked: false };
}

// ── Periodic GC: sweep stale entries every 5 minutes ────────────────────────
// Prevents unbounded memory growth if millions of unique IPs hit the server.
setInterval(() => {
  const now = Date.now();
  for (const [key, w] of _store) {
    if (w.hits.length === 0 || now - w.hits[w.hits.length - 1] > 10 * 60_000) {
      _store.delete(key);
    }
  }
}, 5 * 60_000).unref();
