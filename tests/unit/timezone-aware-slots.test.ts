import { describe, expect, it } from 'vitest';
import { generateTimezoneAwareSlots } from '@/features/appointments/domain/availability';
import type {
  BusinessHoursExceptionRow,
  BusinessHoursRow,
} from '@/features/appointments/domain/daily-schedule';

const TZ = 'Europe/Lisbon';

// Monday-Friday 09:00-19:00 with a 13:00-14:00 lunch, Saturday 09:00-13:00, Sunday closed
// — mirrors DEFAULT_HOURS from src/features/onboarding/domain/hours-step.ts.
const WEEKLY_HOURS: BusinessHoursRow[] = [
  {
    dayOfWeek: 0,
    isOpen: false,
    opensAt: null,
    closesAt: null,
    lunchStartsAt: null,
    lunchEndsAt: null,
  },
  {
    dayOfWeek: 1,
    isOpen: true,
    opensAt: '09:00',
    closesAt: '19:00',
    lunchStartsAt: '13:00',
    lunchEndsAt: '14:00',
  },
  {
    dayOfWeek: 2,
    isOpen: true,
    opensAt: '09:00',
    closesAt: '19:00',
    lunchStartsAt: '13:00',
    lunchEndsAt: '14:00',
  },
  {
    dayOfWeek: 3,
    isOpen: true,
    opensAt: '09:00',
    closesAt: '19:00',
    lunchStartsAt: '13:00',
    lunchEndsAt: '14:00',
  },
  {
    dayOfWeek: 4,
    isOpen: true,
    opensAt: '09:00',
    closesAt: '19:00',
    lunchStartsAt: '13:00',
    lunchEndsAt: '14:00',
  },
  {
    dayOfWeek: 5,
    isOpen: true,
    opensAt: '09:00',
    closesAt: '19:00',
    lunchStartsAt: '13:00',
    lunchEndsAt: '14:00',
  },
  {
    dayOfWeek: 6,
    isOpen: true,
    opensAt: '09:00',
    closesAt: '13:00',
    lunchStartsAt: null,
    lunchEndsAt: null,
  },
];

function baseInput(overrides: Partial<Parameters<typeof generateTimezoneAwareSlots>[0]> = {}) {
  return {
    timeZone: TZ,
    nowMs: Date.UTC(2026, 0, 5, 8, 0, 0), // Monday 2026-01-05 08:00 UTC = 09:00 WET
    minNoticeHours: 3,
    bookingWindowDays: 7,
    slotStepMinutes: 30 as const,
    serviceDurationMinutes: 60,
    bufferMinutes: 15,
    weeklyHours: WEEKLY_HOURS,
    exceptions: [] as BusinessHoursExceptionRow[],
    busy: [],
    ...overrides,
  };
}

describe('generateTimezoneAwareSlots', () => {
  it('only produces slots within open hours, respecting step/duration/buffer', () => {
    const slots = generateTimezoneAwareSlots(
      baseInput({ bookingWindowDays: 1, minNoticeHours: 0 }),
    );

    // Monday 09:00 WET (winter, UTC+0) open interval -> 09:00 UTC; step 30min, occupied 75min.
    const first = slots[0]!;
    expect(new Date(first).toISOString()).toBe('2026-01-05T09:00:00.000Z');
    expect(slots.every((s) => (s - first) % (30 * 60_000) === 0)).toBe(true);

    // Last morning slot before lunch (13:00 WET = 13:00 UTC) must finish by then.
    const morningSlots = slots.filter((s) => s < Date.UTC(2026, 0, 5, 13));
    const lastMorning = morningSlots[morningSlots.length - 1]!;
    expect(lastMorning + 75 * 60_000).toBeLessThanOrEqual(Date.UTC(2026, 0, 5, 13));
  });

  it('R13 (docs/10_RISK_REGISTER.md): rounds an off-grid notice boundary up to the same slot grid the day would otherwise use, not the exact millisecond of `now`', () => {
    // nowMs 08:07 UTC + minNoticeHours 3 = earliestMs 11:07 UTC — deliberately not a
    // multiple of 30min from the 09:00 UTC opening anchor (2h07 = 127min, not a step of
    // 30), unlike every other test's round-hour nowMs.
    const oddNowMs = Date.UTC(2026, 0, 5, 8, 7, 0);
    const slots = generateTimezoneAwareSlots(
      baseInput({ nowMs: oddNowMs, minNoticeHours: 3, bookingWindowDays: 1 }),
    );
    // 09:00 UTC + k*30min grid: the next mark at/after 11:07 UTC is 11:30 UTC, not 11:07.
    expect(new Date(slots[0]!).toISOString()).toBe('2026-01-05T11:30:00.000Z');
  });

  it("R13: the same day's earliest slot stays identical across two calls a few seconds apart, as long as `now` does not cross a slot-interval boundary", () => {
    const baseNowMs = Date.UTC(2026, 0, 5, 8, 7, 0); // earliestMs lands at 11:07 UTC
    const firstCall = generateTimezoneAwareSlots(
      baseInput({ nowMs: baseNowMs, minNoticeHours: 3, bookingWindowDays: 1 }),
    );
    // A recurrence conflict re-check, moments later — earliestMs shifts to 11:07:45 UTC,
    // still short of the next grid mark (11:30), so the chosen slot must not move.
    const secondCall = generateTimezoneAwareSlots(
      baseInput({ nowMs: baseNowMs + 45_000, minNoticeHours: 3, bookingWindowDays: 1 }),
    );
    expect(firstCall[0]).toBe(secondCall[0]);
  });

  it('excludes slots before the minimum notice threshold', () => {
    const slots = generateTimezoneAwareSlots(
      baseInput({ bookingWindowDays: 1, minNoticeHours: 6 }),
    );
    const earliestAllowed = Date.UTC(2026, 0, 5, 14); // nowMs + 6h
    expect(slots.every((s) => s >= earliestAllowed)).toBe(true);
  });

  it('excludes slots beyond the booking window', () => {
    const slots = generateTimezoneAwareSlots(
      baseInput({ bookingWindowDays: 2, minNoticeHours: 0 }),
    );
    const horizonMs = Date.UTC(2026, 0, 5, 8) + 2 * 24 * 60 * 60_000;
    expect(slots.every((s) => s < horizonMs)).toBe(true);
  });

  it('skips closed days entirely (Sunday)', () => {
    const slots = generateTimezoneAwareSlots(
      baseInput({ bookingWindowDays: 7, minNoticeHours: 0 }),
    );
    const sundayStart = Date.UTC(2026, 0, 11, 0);
    const sundayEnd = Date.UTC(2026, 0, 12, 0);
    expect(slots.some((s) => s >= sundayStart && s < sundayEnd)).toBe(false);
  });

  it('removes slots overlapping busy intervals (existing appointments/blocks)', () => {
    const busyStart = Date.UTC(2026, 0, 5, 8);
    const busyEnd = Date.UTC(2026, 0, 5, 10);
    const slots = generateTimezoneAwareSlots(
      baseInput({
        bookingWindowDays: 1,
        minNoticeHours: 0,
        busy: [{ startMs: busyStart, endMs: busyEnd }],
      }),
    );
    expect(slots.some((s) => s < busyEnd)).toBe(false);
  });

  it('prefers a business_hours_exception over the weekly schedule for that date', () => {
    // Monday 2026-01-05 is normally open 09:00-19:00; the exception closes it entirely.
    const exceptions: BusinessHoursExceptionRow[] = [
      {
        exceptionDate: '2026-01-05',
        isOpen: false,
        opensAt: null,
        closesAt: null,
        lunchStartsAt: null,
        lunchEndsAt: null,
      },
    ];
    const slots = generateTimezoneAwareSlots(
      baseInput({ bookingWindowDays: 1, minNoticeHours: 0, exceptions }),
    );
    expect(slots).toEqual([]);
  });

  it('an exception can open a normally-closed day (Sunday) with custom hours', () => {
    const exceptions: BusinessHoursExceptionRow[] = [
      {
        exceptionDate: '2026-01-11',
        isOpen: true,
        opensAt: '10:00',
        closesAt: '12:00',
        lunchStartsAt: null,
        lunchEndsAt: null,
      },
    ];
    const slots = generateTimezoneAwareSlots(
      baseInput({
        nowMs: Date.UTC(2026, 0, 1, 8),
        bookingWindowDays: 15,
        minNoticeHours: 0,
        exceptions,
      }),
    );
    const sundaySlots = slots.filter(
      (s) => s >= Date.UTC(2026, 0, 11, 0) && s < Date.UTC(2026, 0, 12, 0),
    );
    expect(sundaySlots.length).toBeGreaterThan(0);
    expect(new Date(sundaySlots[0]!).toISOString()).toBe('2026-01-11T10:00:00.000Z');
  });

  describe('DST — Europe/Lisbon', () => {
    it('spring-forward (2026-03-29, WET->WEST): opening hour maps to UTC offset +1 after the change', () => {
      // Sunday 2026-03-29 is the transition date; use the exception hook to open it so
      // the transition day itself produces slots to inspect.
      const exceptions: BusinessHoursExceptionRow[] = [
        {
          exceptionDate: '2026-03-29',
          isOpen: true,
          opensAt: '09:00',
          closesAt: '11:00',
          lunchStartsAt: null,
          lunchEndsAt: null,
        },
      ];
      const slots = generateTimezoneAwareSlots(
        baseInput({
          nowMs: Date.UTC(2026, 2, 28, 8),
          bookingWindowDays: 2,
          minNoticeHours: 0,
          serviceDurationMinutes: 30,
          bufferMinutes: 0,
          exceptions,
        }),
      );
      const transitionDaySlots = slots.filter(
        (s) => s >= Date.UTC(2026, 2, 29, 0) && s < Date.UTC(2026, 2, 30, 0),
      );
      expect(transitionDaySlots.length).toBeGreaterThan(0);
      // 09:00 WEST (UTC+1) = 08:00 UTC, not 09:00 UTC as it would be under WET.
      expect(new Date(transitionDaySlots[0]!).toISOString()).toBe('2026-03-29T08:00:00.000Z');
    });

    it('fall-back (2026-10-25, WEST->WET): opening hour maps back to UTC offset +0', () => {
      const exceptions: BusinessHoursExceptionRow[] = [
        {
          exceptionDate: '2026-10-25',
          isOpen: true,
          opensAt: '09:00',
          closesAt: '11:00',
          lunchStartsAt: null,
          lunchEndsAt: null,
        },
      ];
      const slots = generateTimezoneAwareSlots(
        baseInput({
          nowMs: Date.UTC(2026, 9, 24, 8),
          bookingWindowDays: 2,
          minNoticeHours: 0,
          serviceDurationMinutes: 30,
          bufferMinutes: 0,
          exceptions,
        }),
      );
      const transitionDaySlots = slots.filter(
        (s) => s >= Date.UTC(2026, 9, 25, 0) && s < Date.UTC(2026, 9, 26, 0),
      );
      expect(transitionDaySlots.length).toBeGreaterThan(0);
      // 09:00 WET (UTC+0) = 09:00 UTC, not 08:00 UTC as it would still be under WEST.
      expect(new Date(transitionDaySlots[0]!).toISOString()).toBe('2026-10-25T09:00:00.000Z');
    });

    it('a fixed local time span (09:00-19:00) yields the same slot count on the fall-back day as a normal day', () => {
      // On 2026-10-25 the local day has 25 clock hours of elapsed UTC time (the 01:00-02:00
      // WEST->WET repeat), but a *local wall-clock* interval like 09:00-19:00 is still
      // exactly 10 local hours — this asserts the generator counts local wall-clock
      // duration, not elapsed UTC ms. Both days use the same no-lunch exception shape so
      // only the DST transition itself differs between them.
      const noLunchException = (date: string): BusinessHoursExceptionRow => ({
        exceptionDate: date,
        isOpen: true,
        opensAt: '09:00',
        closesAt: '19:00',
        lunchStartsAt: null,
        lunchEndsAt: null,
      });

      const normalDaySlots = generateTimezoneAwareSlots(
        baseInput({
          nowMs: Date.UTC(2026, 9, 19, 8), // Monday before the transition week
          bookingWindowDays: 1,
          minNoticeHours: 0,
          slotStepMinutes: 30,
          serviceDurationMinutes: 30,
          bufferMinutes: 0,
          exceptions: [noLunchException('2026-10-19')],
        }),
      ).filter((s) => s < Date.UTC(2026, 9, 20, 0));

      const transitionDaySlots = generateTimezoneAwareSlots(
        baseInput({
          nowMs: Date.UTC(2026, 9, 25, 0),
          bookingWindowDays: 1,
          minNoticeHours: 0,
          slotStepMinutes: 30,
          serviceDurationMinutes: 30,
          bufferMinutes: 0,
          exceptions: [noLunchException('2026-10-25')],
        }),
      ).filter((s) => s < Date.UTC(2026, 9, 26, 0));

      expect(normalDaySlots.length).toBe(20);
      expect(transitionDaySlots.length).toBe(normalDaySlots.length);
    });
  });
});
