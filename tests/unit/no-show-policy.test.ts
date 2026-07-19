import { describe, expect, it } from 'vitest';
import {
  countRecentNoShows,
  exceedsNoShowLimit,
  type NoShowAppointment,
} from '@/features/clients/domain/no-show-policy';

const NOW = new Date('2026-07-20T12:00:00Z').getTime();

describe('countRecentNoShows', () => {
  it('counts only no_show appointments', () => {
    const appointments: NoShowAppointment[] = [
      { status: 'no_show', startAt: '2026-07-01T10:00:00Z' },
      { status: 'completed', startAt: '2026-07-02T10:00:00Z' },
      { status: 'cancelled', startAt: '2026-07-03T10:00:00Z' },
    ];
    expect(countRecentNoShows(appointments, 90, NOW)).toBe(1);
  });

  it('excludes no_show appointments outside the window', () => {
    const appointments: NoShowAppointment[] = [
      { status: 'no_show', startAt: '2026-01-01T10:00:00Z' },
      { status: 'no_show', startAt: '2026-07-10T10:00:00Z' },
    ];
    expect(countRecentNoShows(appointments, 30, NOW)).toBe(1);
  });

  it('returns 0 when there are no appointments', () => {
    expect(countRecentNoShows([], 90, NOW)).toBe(0);
  });
});

describe('exceedsNoShowLimit', () => {
  it('is false when the policy has no limit configured', () => {
    expect(exceedsNoShowLimit(10, { limit: null, windowDays: 90 })).toBe(false);
  });

  it('is false when the count is below the limit', () => {
    expect(exceedsNoShowLimit(1, { limit: 2, windowDays: 90 })).toBe(false);
  });

  it('is true when the count reaches the limit', () => {
    expect(exceedsNoShowLimit(2, { limit: 2, windowDays: 90 })).toBe(true);
  });

  it('is true when the count exceeds the limit', () => {
    expect(exceedsNoShowLimit(5, { limit: 2, windowDays: 90 })).toBe(true);
  });
});
