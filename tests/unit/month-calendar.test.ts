import { describe, expect, it } from 'vitest';
import { buildCalendarMonth, shiftMonthKey } from '@/app/b/[slug]/domain/month-calendar';

describe('buildCalendarMonth', () => {
  it('pads to a multiple of 7 days', () => {
    const month = buildCalendarMonth('2026-07', new Set(), '2026-07-01');
    expect(month.days.length % 7).toBe(0);
  });

  it('includes every day of the target month marked inCurrentMonth', () => {
    const month = buildCalendarMonth('2026-07', new Set(), '2026-07-01');
    const inMonth = month.days.filter((d) => d.inCurrentMonth);
    expect(inMonth).toHaveLength(31);
    expect(inMonth[0]!.dateKey).toBe('2026-07-01');
    expect(inMonth[30]!.dateKey).toBe('2026-07-31');
  });

  it('pads the start of the grid with the tail of the previous month', () => {
    // 2026-07-01 is a Wednesday (weekday 3), so 3 days of June padding lead the grid.
    const month = buildCalendarMonth('2026-07', new Set(), '2026-07-01');
    const leadingPad = month.days.filter((d) => !d.inCurrentMonth && d.dateKey < '2026-07-01');
    expect(leadingPad).toHaveLength(3);
    expect(leadingPad.map((d) => d.dateKey)).toEqual(['2026-06-28', '2026-06-29', '2026-06-30']);
  });

  it('marks days present in slotDateKeys as hasSlots', () => {
    const month = buildCalendarMonth(
      '2026-07',
      new Set(['2026-07-15', '2026-07-20']),
      '2026-07-01',
    );
    const day15 = month.days.find((d) => d.dateKey === '2026-07-15');
    const day16 = month.days.find((d) => d.dateKey === '2026-07-16');
    expect(day15?.hasSlots).toBe(true);
    expect(day16?.hasSlots).toBe(false);
  });

  it('marks days before todayKey as isPast', () => {
    const month = buildCalendarMonth('2026-07', new Set(), '2026-07-15');
    const before = month.days.find((d) => d.dateKey === '2026-07-10');
    const after = month.days.find((d) => d.dateKey === '2026-07-20');
    const today = month.days.find((d) => d.dateKey === '2026-07-15');
    expect(before?.isPast).toBe(true);
    expect(after?.isPast).toBe(false);
    expect(today?.isPast).toBe(false);
  });

  it('produces a capitalized pt-PT month label', () => {
    const month = buildCalendarMonth('2026-08', new Set(), '2026-08-01');
    expect(month.label).toBe('Agosto 2026');
  });

  it('handles December correctly (year rollover in next-month padding)', () => {
    const month = buildCalendarMonth('2026-12', new Set(), '2026-12-01');
    const trailingPad = month.days.filter((d) => !d.inCurrentMonth && d.dateKey > '2026-12-31');
    for (const day of trailingPad) {
      expect(day.dateKey.startsWith('2027-01')).toBe(true);
    }
  });
});

describe('shiftMonthKey', () => {
  it('moves forward a month', () => {
    expect(shiftMonthKey('2026-07', 1)).toBe('2026-08');
  });

  it('moves backward a month', () => {
    expect(shiftMonthKey('2026-07', -1)).toBe('2026-06');
  });

  it('rolls over the year forward', () => {
    expect(shiftMonthKey('2026-12', 1)).toBe('2027-01');
  });

  it('rolls over the year backward', () => {
    expect(shiftMonthKey('2026-01', -1)).toBe('2025-12');
  });
});
