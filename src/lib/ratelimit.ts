// Best-effort rate limiting for the two public /api routes. Both spend something
// real on behalf of an anonymous caller — an account on the shared ecosystem
// GoTrue, or ecosystem Anthropic credit — so neither should be a free faucet.
//
// HONEST LIMITATION: these counters live in module memory. On Vercel that means
// per-instance and gone on every cold start, so a caller spread across instances
// gets some multiple of each limit. It still turns "curl in a loop" from free
// into expensive, with no new dependency and no extra network hop. When we want
// a limit we can actually promise, the durable versions are (a) a small
// ff_rate_limits table on the shared Supabase, written with the service-role key,
// or (b) Upstash Redis. Swapping the body of rateLimit() is the whole change —
// callers stay the same.

import { createHash } from "node:crypto";

type Verdict = { ok: true } | { ok: false; retryAfterSec: number };

// bucket key -> recent hit timestamps (ms). Pruned on read.
const hits = new Map<string, number[]>();
const MAX_KEYS = 5000;                  // rough ceiling so a spray of keys can't grow forever
const STALE_MS = 60 * 60 * 1000;

function sweepStale(now: number) {
  for (const [key, times] of hits) {
    if (!times.length || now - times[times.length - 1] > STALE_MS) hits.delete(key);
  }
}

// Sliding window: allow `limit` hits per `windowMs` for this bucket.
export function rateLimit(key: string, limit: number, windowMs: number): Verdict {
  const now = Date.now();
  if (hits.size > MAX_KEYS) sweepStale(now);
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    const waitMs = windowMs - (now - recent[0]);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil(waitMs / 1000)) };
  }
  recent.push(now);
  hits.set(key, recent);
  return { ok: true };
}

// Best-effort caller identity. Vercel sets x-forwarded-for and the first entry is
// the client. Spoofable, so it's only ever used for throttling — never for trust.
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const first = forwarded.split(",")[0].trim();
  return first || request.headers.get("x-real-ip") || "unknown";
}

// Hash before using something personal (an email) as a bucket key, so plaintext
// addresses never sit in server memory just because someone tried to sign up.
export function hashKey(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}
