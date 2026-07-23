import { describe, expect, it } from 'vitest';
import {
  resolveCalendarRange,
  shiftCalendarDate,
  formatRangeLabel,
} from '@/features/appointments/domain/calendar-navigation';

const TZ = 'Europe/Lisbon';

describe('resolveCalendarRange — day', () => {
  it('spans exactly one local calendar day', () => {
    const range = resolveCalendarRange('day', '2026-01-05', TZ);
    expect(range.dateKeys).toEqual(['2026-01-05']);
    expect(range.startIso).toBe('2026-01-05T00:00:00.000Z'); // WET, UTC+0 in January
    expect(range.endIso).toBe('2026-01-06T00:00:00.000Z');
  });
});

describe('resolveCalendarRange — week', () => {
  it('starts on Monday and covers 7 days', () => {
    // 2026-01-07 is a Wednesday.
    const range = resolveCalendarRange('week', '2026-01-07', TZ);
    expect(range.dateKeys).toHaveLength(7);
    expect(range.dateKeys[0]).toBe('2026-01-05'); // Monday
    expect(range.dateKeys[6]).toBe('2026-01-11'); // Sunday
  });

  it('anchoring on a Sunday still resolves to that same week (Mon-Sun)', () => {
    const range = resolveCalendarRange('week', '2026-01-11', TZ); // Sunday
    expect(range.dateKeys[0]).toBe('2026-01-05');
    expect(range.dateKeys[6]).toBe('2026-01-11');
  });
});

describe('resolveCalendarRange — month', () => {
  it('covers every day of the given month', () => {
    const range = resolveCalendarRange('month', '2026-02-15', TZ);
    expect(range.dateKeys).toHaveLength(28); // 2026 is not a leap year
    expect(range.dateKeys[0]).toBe('2026-02-01');
    expect(range.dateKeys[27]).toBe('2026-02-28');
  });

  it('handles a leap-year February correctly', () => {
    const range = resolveCalendarRange('month', '2028-02-10', TZ);
    expect(range.dateKeys).toHaveLength(29);
    expect(range.dateKeys[28]).toBe('2028-02-29');
  });
});

describe('resolveCalendarRange — week during WEST (summer time, UTC+1)', () => {
  it('still starts on the correct Monday, not shifted a day earlier by the UTC+1 offset', () => {
    // Regression: startOfWeekKey used to compute the weekday via a real timezone
    // conversion (fromZonedTime(...).getUTCDay()) — during WEST, local midnight
    // converts to 23:00 UTC the previous day, so the weekday silently came back one
    // day early (Wednesday read as Tuesday), shifting the whole week's Monday.
    // 2026-05-20 is a Wednesday.
    const range = resolveCalendarRange('week', '2026-05-20', TZ);
    expect(range.dateKeys[0]).toBe('2026-05-18'); // Monday
    expect(range.dateKeys[6]).toBe('2026-05-24'); // Sunday
    expect(range.dateKeys).toContain('2026-05-20');
  });

  it('anchoring on a Sunday during WEST still resolves to that same Mon-Sun week', () => {
    // 2026-05-24 is a Sunday.
    const range = resolveCalendarRange('week', '2026-05-24', TZ);
    expect(range.dateKeys[0]).toBe('2026-05-18');
    expect(range.dateKeys[6]).toBe('2026-05-24');
  });
});

describe('resolveCalendarRange — DST boundaries', () => {
  it('day view on the spring-forward transition date resolves correct UTC boundaries', () => {
    // 2026-03-29: WET (UTC+0) before, WEST (UTC+1) from 01:00 UTC onward.
    const range = resolveCalendarRange('day', '2026-03-29', TZ);
    expect(range.startIso).toBe('2026-03-29T00:00:00.000Z');
    // Next day's 00:00 WEST = 23:00 UTC the previous day.
    expect(range.endIso).toBe('2026-03-29T23:00:00.000Z');
  });

  it('week view spanning the spring-forward transition has a 1h-off elapsed span consistent with one lost hour', () => {
    // 2026-03-29 (the transition Sunday) falls in the Mon 2026-03-23 – Sun 2026-03-29
    // week — anchoring anywhere in that week (e.g. Wednesday the 25th) must resolve to
    // that same Monday, not the following one.
    const range = resolveCalendarRange('week', '2026-03-25', TZ);
    expect(range.dateKeys[0]).toBe('2026-03-23');
    expect(range.dateKeys[6]).toBe('2026-03-29');
    const elapsedMs = new Date(range.endIso).getTime() - new Date(range.startIso).getTime();
    // A normal 7-day span is 7*24h; the DST week loses exactly 1 hour.
    expect(elapsedMs).toBe(7 * 24 * 60 * 60_000 - 60 * 60_000);
  });

  it('month view spanning the fall-back transition (2026-10-25) has one extra hour of elapsed time', () => {
    const range = resolveCalendarRange('month', '2026-10-15', TZ);
    const days = range.dateKeys.length;
    const elapsedMs = new Date(range.endIso).getTime() - new Date(range.startIso).getTime();
    expect(elapsedMs).toBe(days * 24 * 60 * 60_000 + 60 * 60_000);
  });
});

describe('shiftCalendarDate', () => {
  it('day view moves by exactly one day', () => {
    expect(shiftCalendarDate('day', '2026-01-05', 1)).toBe('2026-01-06');
    expect(shiftCalendarDate('day', '2026-01-05', -1)).toBe('2026-01-04');
  });

  it('week view moves by exactly seven days', () => {
    expect(shiftCalendarDate('week', '2026-01-05', 1)).toBe('2026-01-12');
    expect(shiftCalendarDate('week', '2026-01-05', -1)).toBe('2025-12-29');
  });

  it('month view moves to the next/previous calendar month', () => {
    expect(shiftCalendarDate('month', '2026-01-15', 1)).toBe('2026-02-15');
    expect(shiftCalendarDate('month', '2026-01-15', -1)).toBe('2025-12-15');
  });

  it('month navigation across a shorter month does not skip a month (clamped to day 28)', () => {
    // Jan 31 + 1 month must land in February, not skip to March.
    expect(shiftCalendarDate('month', '2026-01-31', 1)).toBe('2026-02-28');
  });

  it('crosses a year boundary correctly in both directions', () => {
    expect(shiftCalendarDate('day', '2025-12-31', 1)).toBe('2026-01-01');
    expect(shiftCalendarDate('month', '2026-01-15', -1)).toBe('2025-12-15');
  });
});

describe('formatRangeLabel', () => {
  it('formats a day label in pt-PT with the weekday', () => {
    const range = resolveCalendarRange('day', '2026-06-15', TZ);
    expect(formatRangeLabel('day', range.dateKeys, TZ)).toBe('15 de junho, segunda-feira');
  });

  it('formats a week label as a dd/MM range', () => {
    const range = resolveCalendarRange('week', '2026-01-07', TZ);
    expect(formatRangeLabel('week', range.dateKeys, TZ)).toBe('05/01 – 11/01');
  });

  it('formats a month label in pt-PT', () => {
    const range = resolveCalendarRange('month', '2026-06-15', TZ);
    expect(formatRangeLabel('month', range.dateKeys, TZ)).toBe('junho de 2026');
  });
});
