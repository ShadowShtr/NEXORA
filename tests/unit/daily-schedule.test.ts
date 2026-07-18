import { describe, expect, it } from 'vitest';
import {
  dayHoursToOpenIntervals,
  resolveDayHours,
  type BusinessHoursExceptionRow,
  type BusinessHoursRow,
} from '@/features/appointments/domain/daily-schedule';

const WEEKLY_HOURS: BusinessHoursRow[] = [
  {
    dayOfWeek: 1,
    isOpen: true,
    opensAt: '09:00',
    closesAt: '19:00',
    lunchStartsAt: '13:00',
    lunchEndsAt: '14:00',
  },
];

describe('resolveDayHours', () => {
  it('falls back to the weekly schedule when there is no exception for the date', () => {
    const result = resolveDayHours('2026-01-05', 1, WEEKLY_HOURS, []);
    expect(result).toEqual({
      isOpen: true,
      opensAt: '09:00',
      closesAt: '19:00',
      lunchStartsAt: '13:00',
      lunchEndsAt: '14:00',
    });
  });

  it('prefers an exception over the weekly schedule for the same date', () => {
    const exceptions: BusinessHoursExceptionRow[] = [
      {
        exceptionDate: '2026-01-05',
        isOpen: true,
        opensAt: '10:00',
        closesAt: '12:00',
        lunchStartsAt: null,
        lunchEndsAt: null,
      },
    ];
    const result = resolveDayHours('2026-01-05', 1, WEEKLY_HOURS, exceptions);
    expect(result).toEqual({
      isOpen: true,
      opensAt: '10:00',
      closesAt: '12:00',
      lunchStartsAt: null,
      lunchEndsAt: null,
    });
  });

  it('treats a day with no weekly row and no exception as closed', () => {
    const result = resolveDayHours('2026-01-04', 0, WEEKLY_HOURS, []);
    expect(result.isOpen).toBe(false);
  });
});

describe('dayHoursToOpenIntervals', () => {
  it('returns a single interval when there is no lunch break', () => {
    const intervals = dayHoursToOpenIntervals(
      '2026-01-05',
      { isOpen: true, opensAt: '10:00', closesAt: '12:00', lunchStartsAt: null, lunchEndsAt: null },
      'Europe/Lisbon',
    );
    expect(intervals).toEqual([
      { startMs: Date.UTC(2026, 0, 5, 10), endMs: Date.UTC(2026, 0, 5, 12) },
    ]);
  });

  it('splits into two intervals around a lunch break', () => {
    const intervals = dayHoursToOpenIntervals(
      '2026-01-05',
      {
        isOpen: true,
        opensAt: '09:00',
        closesAt: '19:00',
        lunchStartsAt: '13:00',
        lunchEndsAt: '14:00',
      },
      'Europe/Lisbon',
    );
    expect(intervals).toEqual([
      { startMs: Date.UTC(2026, 0, 5, 9), endMs: Date.UTC(2026, 0, 5, 13) },
      { startMs: Date.UTC(2026, 0, 5, 14), endMs: Date.UTC(2026, 0, 5, 19) },
    ]);
  });

  it('returns no intervals for a closed day', () => {
    const intervals = dayHoursToOpenIntervals(
      '2026-01-04',
      { isOpen: false, opensAt: null, closesAt: null, lunchStartsAt: null, lunchEndsAt: null },
      'Europe/Lisbon',
    );
    expect(intervals).toEqual([]);
  });
});
