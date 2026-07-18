import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// NEX-066: distributed rate limiting for public, unauthenticated write/read surfaces
// (getPublicAvailability, createPublicBooking). CLAUDE.md forbids in-memory rate
// limiting for serverless — each invocation can land on a different instance, so
// per-process counters would never see the same request twice. Upstash's REST-based
// Redis is the sliding-window store; RATE_LIMIT_REDIS_URL/_TOKEN are optional
// (docs/ENVIRONMENTS_AND_SECRETS.md: "avaliar necessidade real antes de provisionar"),
// so this degrades to "not limited" rather than failing the request when unset —
// tracked as a residual risk in EPIC-06.md until the Upstash project is provisioned.
//
// Reads process.env directly instead of going through src/lib/env.ts's serverEnv():
// that module parses the full app schema (including required NEXT_PUBLIC_* Supabase
// vars) eagerly at import time, which would make this file — and every unit test that
// imports it — depend on unrelated Supabase env vars being present.
let cachedLimiters: { availability: Ratelimit; booking: Ratelimit } | null = null;

function getLimiters(): { availability: Ratelimit; booking: Ratelimit } | null {
  if (cachedLimiters) return cachedLimiters;

  const RATE_LIMIT_REDIS_URL = process.env.RATE_LIMIT_REDIS_URL;
  const RATE_LIMIT_REDIS_TOKEN = process.env.RATE_LIMIT_REDIS_TOKEN;
  if (!RATE_LIMIT_REDIS_URL || !RATE_LIMIT_REDIS_TOKEN) return null;

  const redis = new Redis({ url: RATE_LIMIT_REDIS_URL, token: RATE_LIMIT_REDIS_TOKEN });

  cachedLimiters = {
    // Availability is read-only but still expensive (multiple table scans per call,
    // NEX-062) — generous enough for a real visitor paging through days, tight enough
    // to blunt a scripted scraper.
    availability: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '1 m'),
      prefix: 'nexora:ratelimit:availability',
    }),
    // Booking creation is a write with real side effects (client upsert, appointment,
    // reminder) — deliberately tighter than availability.
    booking: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '1 m'),
      prefix: 'nexora:ratelimit:booking',
    }),
  };
  return cachedLimiters;
}

export type RateLimitResult = { limited: false } | { limited: true; retryAfterSeconds: number };

async function check(limiter: Ratelimit, identifier: string): Promise<RateLimitResult> {
  const { success, reset } = await limiter.limit(identifier);
  if (success) return { limited: false };
  return { limited: true, retryAfterSeconds: Math.max(1, Math.ceil((reset - Date.now()) / 1000)) };
}

export async function checkAvailabilityRateLimit(identifier: string): Promise<RateLimitResult> {
  const limiters = getLimiters();
  if (!limiters) return { limited: false };
  return check(limiters.availability, identifier);
}

export async function checkBookingRateLimit(identifier: string): Promise<RateLimitResult> {
  const limiters = getLimiters();
  if (!limiters) return { limited: false };
  return check(limiters.booking, identifier);
}
