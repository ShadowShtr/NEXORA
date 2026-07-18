import { describe, expect, it } from 'vitest';
import { groupSlotsByDay } from '@/app/b/[slug]/domain/slot-formatting';

describe('groupSlotsByDay', () => {
  it('groups slots into one entry per calendar day, sorted chronologically', () => {
    const slots = [
      '2026-01-06T09:00:00.000Z', // Tue 2026-01-06 09:00 WET (winter, UTC+0)
      '2026-01-06T09:30:00.000Z',
      '2026-01-05T09:00:00.000Z', // Mon 2026-01-05, out of order on purpose
    ];
    const groups = groupSlotsByDay(slots, 'Europe/Lisbon');

    expect(groups).toHaveLength(2);
    expect(groups[0]!.dateKey).toBe('2026-01-05');
    expect(groups[1]!.dateKey).toBe('2026-01-06');
    expect(groups[1]!.slots.map((s) => s.timeLabel)).toEqual(['09:00', '09:30']);
  });

  it('produces a capitalized pt-PT weekday label', () => {
    const groups = groupSlotsByDay(['2026-01-05T09:00:00.000Z'], 'Europe/Lisbon');
    expect(groups[0]!.dateLabel).toBe('Segunda-feira · 05/01');
  });

  it('formats the time label in the tenant timezone, not UTC', () => {
    // 2026-01-05 09:00 WET (UTC+0 in winter) -> should read 09:00, not 10:00.
    const groups = groupSlotsByDay(['2026-01-05T09:00:00.000Z'], 'Europe/Lisbon');
    expect(groups[0]!.slots[0]!.timeLabel).toBe('09:00');
  });

  it('returns an empty array for no slots', () => {
    expect(groupSlotsByDay([], 'Europe/Lisbon')).toEqual([]);
  });
});
