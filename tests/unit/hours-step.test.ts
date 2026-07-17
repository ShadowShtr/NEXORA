import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HOURS,
  hoursStepSchema,
  mergeHoursWithDefaults,
} from '@/features/onboarding/domain/hours-step';

function withDay(overrides: Partial<(typeof DEFAULT_HOURS)[number]> & { dayOfWeek: number }) {
  return DEFAULT_HOURS.map((day) =>
    day.dayOfWeek === overrides.dayOfWeek ? { ...day, ...overrides } : day,
  );
}

describe('hoursStepSchema', () => {
  it('accepts the recommended defaults', () => {
    const result = hoursStepSchema.safeParse({ days: DEFAULT_HOURS });
    expect(result.success).toBe(true);
  });

  it('rejects a closing time at or before the opening time', () => {
    const days = withDay({ dayOfWeek: 1, opensAt: '19:00', closesAt: '09:00' });
    const result = hoursStepSchema.safeParse({ days });
    expect(result.success).toBe(false);
  });

  it('accepts a closed day with empty times regardless of format', () => {
    const days = withDay({ dayOfWeek: 0, isOpen: false, opensAt: '', closesAt: '' });
    const result = hoursStepSchema.safeParse({ days });
    expect(result.success).toBe(true);
  });

  it('rejects only one of the two lunch times being set', () => {
    const days = withDay({ dayOfWeek: 1, lunchStartsAt: '13:00', lunchEndsAt: '' });
    const result = hoursStepSchema.safeParse({ days });
    expect(result.success).toBe(false);
  });

  it('rejects a lunch end at or before the lunch start', () => {
    const days = withDay({ dayOfWeek: 1, lunchStartsAt: '14:00', lunchEndsAt: '13:00' });
    const result = hoursStepSchema.safeParse({ days });
    expect(result.success).toBe(false);
  });

  it('accepts an open day with no lunch break at all', () => {
    const days = withDay({ dayOfWeek: 6, lunchStartsAt: '', lunchEndsAt: '' });
    const result = hoursStepSchema.safeParse({ days });
    expect(result.success).toBe(true);
  });

  it('accepts boundary times at the edges of a day', () => {
    const days = withDay({
      dayOfWeek: 6,
      opensAt: '00:00',
      closesAt: '23:59',
      lunchStartsAt: '',
      lunchEndsAt: '',
    });
    const result = hoursStepSchema.safeParse({ days });
    expect(result.success).toBe(true);
  });

  it('requires exactly 7 days', () => {
    const result = hoursStepSchema.safeParse({ days: DEFAULT_HOURS.slice(0, 6) });
    expect(result.success).toBe(false);
  });
});

describe('mergeHoursWithDefaults', () => {
  it('falls back to defaults for a day with no saved row', () => {
    const merged = mergeHoursWithDefaults([]);
    expect(merged).toEqual(DEFAULT_HOURS);
  });

  it('truncates Postgres HH:MM:SS time values to HH:MM', () => {
    const merged = mergeHoursWithDefaults([
      {
        day_of_week: 1,
        is_open: true,
        opens_at: '08:30:00',
        closes_at: '18:00:00',
        lunch_starts_at: null,
        lunch_ends_at: null,
      },
    ]);
    const monday = merged.find((day) => day.dayOfWeek === 1)!;
    expect(monday.opensAt).toBe('08:30');
    expect(monday.closesAt).toBe('18:00');
    expect(monday.lunchStartsAt).toBe('');
  });
});
