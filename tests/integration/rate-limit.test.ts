import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

// Exercises checkAvailabilityRateLimit/checkBookingRateLimit (NEX-066,
// src/lib/rate-limit.ts) against a real Upstash Redis REST endpoint — the graceful
// degradation path (unconfigured -> never limited) is covered unconditionally by
// tests/unit/rate-limit.test.ts; this file is specifically the "actual 429 after the
// limit is exceeded" and "a fresh identifier is unaffected" cases from the task's
// acceptance criteria, which need a real distributed store to observe. Requires
// RATE_LIMIT_REDIS_URL and RATE_LIMIT_REDIS_TOKEN (an Upstash Redis database's REST
// credentials); skips cleanly when unset, same pattern as every other credential-gated
// integration test in this repo.
const canRun = Boolean(process.env.RATE_LIMIT_REDIS_URL && process.env.RATE_LIMIT_REDIS_TOKEN);

describe.runIf(canRun)('rate limiting against real Upstash Redis (NEX-066)', () => {
  it('returns limited: true with a retryAfterSeconds once the booking limit is exceeded', async () => {
    const { checkBookingRateLimit } = await import('@/lib/rate-limit');
    const identifier = `test-${randomUUID()}`;

    // Booking limiter is configured for 5 requests per minute (src/lib/rate-limit.ts).
    for (let i = 0; i < 5; i += 1) {
      const result = await checkBookingRateLimit(identifier);
      expect(result).toEqual({ limited: false });
    }

    const sixth = await checkBookingRateLimit(identifier);
    expect(sixth.limited).toBe(true);
    if (sixth.limited) {
      expect(sixth.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it('a different identifier (legitimate bypass) is unaffected by another IP being limited', async () => {
    const { checkBookingRateLimit } = await import('@/lib/rate-limit');
    const limitedIdentifier = `test-${randomUUID()}`;
    const freshIdentifier = `test-${randomUUID()}`;

    for (let i = 0; i < 6; i += 1) {
      await checkBookingRateLimit(limitedIdentifier);
    }

    const fresh = await checkBookingRateLimit(freshIdentifier);
    expect(fresh).toEqual({ limited: false });
  });

  it('availability and booking limiters are tracked independently per identifier', async () => {
    const { checkAvailabilityRateLimit, checkBookingRateLimit } = await import('@/lib/rate-limit');
    const identifier = `test-${randomUUID()}`;

    for (let i = 0; i < 5; i += 1) {
      await checkBookingRateLimit(identifier);
    }
    const bookingResult = await checkBookingRateLimit(identifier);
    expect(bookingResult.limited).toBe(true);

    // Same identifier, different (much more generous) limiter — must not be blocked by
    // the booking limiter's exhaustion.
    const availabilityResult = await checkAvailabilityRateLimit(identifier);
    expect(availabilityResult).toEqual({ limited: false });
  });

  // NEX-166 (security review): login/password-reset had no rate limit at all before
  // this task — same "real 429 after the limit" shape as the booking tests above.
  it('returns limited: true once the login e-mail limit is exceeded, independently of the login IP limiter', async () => {
    const { checkLoginEmailRateLimit, checkLoginIpRateLimit } = await import('@/lib/rate-limit');
    const email = `test-${randomUUID()}@example.test`;
    const ip = `198.51.100.${Math.floor(Math.random() * 254) + 1}`;

    // Login-by-email limiter is configured for 8 requests per 5 minutes.
    for (let i = 0; i < 8; i += 1) {
      const result = await checkLoginEmailRateLimit(email);
      expect(result).toEqual({ limited: false });
    }
    const ninth = await checkLoginEmailRateLimit(email);
    expect(ninth.limited).toBe(true);

    // A fresh IP hitting the same (now-exhausted) e-mail isn't blocked by the IP
    // limiter, which tracks a completely different identifier.
    const ipResult = await checkLoginIpRateLimit(ip);
    expect(ipResult).toEqual({ limited: false });
  });

  it('returns limited: true once the password reset limit is exceeded', async () => {
    const { checkPasswordResetRateLimit } = await import('@/lib/rate-limit');
    const identifier = `test-${randomUUID()}`;

    // Password reset limiter is configured for 5 requests per 5 minutes.
    for (let i = 0; i < 5; i += 1) {
      const result = await checkPasswordResetRateLimit(identifier);
      expect(result).toEqual({ limited: false });
    }
    const sixth = await checkPasswordResetRateLimit(identifier);
    expect(sixth.limited).toBe(true);
  });
});
