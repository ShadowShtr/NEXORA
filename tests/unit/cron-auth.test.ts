import { describe, expect, it } from 'vitest';
import { isAuthorizedCronRequest } from '@/lib/cron-auth';

// NEX-161: gate for /api/cron/cleanup-booking-drafts.
describe('isAuthorizedCronRequest', () => {
  it('accepts any caller when CRON_SECRET is not configured (documented degrade)', () => {
    expect(isAuthorizedCronRequest(null, undefined)).toBe(true);
    expect(isAuthorizedCronRequest('Bearer whatever', undefined)).toBe(true);
  });

  it('requires the exact bearer token when CRON_SECRET is configured', () => {
    expect(isAuthorizedCronRequest('Bearer secret123', 'secret123')).toBe(true);
    expect(isAuthorizedCronRequest('Bearer wrong', 'secret123')).toBe(false);
    expect(isAuthorizedCronRequest(null, 'secret123')).toBe(false);
    expect(isAuthorizedCronRequest('secret123', 'secret123')).toBe(false);
  });
});
