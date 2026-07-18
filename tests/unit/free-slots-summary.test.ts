import { describe, expect, it } from 'vitest';
import {
  groupFreeSlotsByDay,
  filterFreeSlotsInRange,
} from '@/features/appointments/domain/free-slots-summary';

const TZ = 'Europe/Lisbon';

describe('groupFreeSlotsByDay', () => {
  it('groups slots into one entry per local calendar day, sorted chronologically', () => {
    const slots = [
      Date.UTC(2026, 0, 6, 9, 0), // 2026-01-06 09:00 WET
      Date.UTC(2026, 0, 6, 9, 30),
      Date.UTC(2026, 0, 5, 9, 0), // out of order on purpose
    ];
    const groups = groupFreeSlotsByDay(slots, TZ);

    expect(groups).toHaveLength(2);
    expect(groups[0]!.dateKey).toBe('2026-01-05');
    expect(groups[0]!.count).toBe(1);
    expect(groups[1]!.dateKey).toBe('2026-01-06');
    expect(groups[1]!.count).toBe(2);
  });

  it('returns an empty array for no slots', () => {
    expect(groupFreeSlotsByDay([], TZ)).toEqual([]);
  });
});

describe('filterFreeSlotsInRange', () => {
  it('keeps only groups whose dateKey is within the given range', () => {
    const groups = groupFreeSlotsByDay(
      [Date.UTC(2026, 0, 5, 9, 0), Date.UTC(2026, 0, 10, 9, 0)],
      TZ,
    );
    const filtered = filterFreeSlotsInRange(groups, ['2026-01-05', '2026-01-06']);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.dateKey).toBe('2026-01-05');
  });
});
