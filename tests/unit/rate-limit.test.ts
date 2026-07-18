import { describe, expect, it } from 'vitest';
import { checkAvailabilityRateLimit, checkBookingRateLimit } from '@/lib/rate-limit';
import { verifyTurnstileToken } from '@/lib/turnstile';

// NEX-066: RATE_LIMIT_REDIS_URL/_TOKEN and TURNSTILE_SECRET_KEY are optional
// (docs/ENVIRONMENTS_AND_SECRETS.md — not yet provisioned for this project). These
// tests run against whatever env vars are actually set; in this repo's current state
// neither is configured, so they exercise the "graceful degradation" path:
// unconfigured must mean "not limited" / "assume human", never an outage for every
// visitor. A full Upstash-backed 429 test needs real credentials and is out of reach
// here — recorded as a residual risk in EPIC-06.md.
describe('rate limiting (fails open when unconfigured)', () => {
  it('checkAvailabilityRateLimit never blocks without Upstash credentials', async () => {
    const result = await checkAvailabilityRateLimit('203.0.113.1');
    expect(result).toEqual({ limited: false });
  });

  it('checkBookingRateLimit never blocks without Upstash credentials', async () => {
    const result = await checkBookingRateLimit('203.0.113.1');
    expect(result).toEqual({ limited: false });
  });
});

describe('verifyTurnstileToken (fails open when unconfigured)', () => {
  it('treats every visitor as human without TURNSTILE_SECRET_KEY, even with no token', async () => {
    const result = await verifyTurnstileToken('', '203.0.113.1');
    expect(result).toBe(true);
  });
});
