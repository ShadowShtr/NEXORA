import { describe, expect, it } from 'vitest';
import { detectRecurrenceConflicts } from '@/features/appointments/domain/recurrence-conflicts';

const minute = 60_000;
const hour = 60 * minute;

describe('detectRecurrenceConflicts', () => {
  it('flags no conflict when every occurrence is in the available set', () => {
    const occurrences = [0, hour, 2 * hour];
    const checks = detectRecurrenceConflicts(occurrences, occurrences);
    expect(checks).toEqual([
      { occurrenceMs: 0, hasConflict: false, alternativeSlotsMs: [] },
      { occurrenceMs: hour, hasConflict: false, alternativeSlotsMs: [] },
      { occurrenceMs: 2 * hour, hasConflict: false, alternativeSlotsMs: [] },
    ]);
  });

  it('flags a conflict for an occurrence absent from the available set', () => {
    const occurrences = [0, hour];
    const available = [0]; // hour is taken (not free)
    const checks = detectRecurrenceConflicts(occurrences, available);
    expect(checks[0]).toEqual({ occurrenceMs: 0, hasConflict: false, alternativeSlotsMs: [] });
    expect(checks[1]!.hasConflict).toBe(true);
  });

  it('suggests the nearest available slots first, then re-orders them chronologically', () => {
    const occurrence = 10 * hour;
    const available = [0, 5 * hour, 9 * hour, 11 * hour, 20 * hour];
    const [check] = detectRecurrenceConflicts([occurrence], available, 3);
    // Closest by distance: 9h (1h away), 11h (1h away), 5h (5h away) — tie broken by
    // array order (9h appears before 11h in `available`) — then re-sorted ascending.
    expect(check!.alternativeSlotsMs).toEqual([5 * hour, 9 * hour, 11 * hour]);
  });

  it('caps alternatives at maxAlternatives', () => {
    const occurrence = 0;
    const available = [hour, 2 * hour, 3 * hour, 4 * hour, 5 * hour];
    const [check] = detectRecurrenceConflicts([occurrence], available, 2);
    expect(check!.alternativeSlotsMs).toHaveLength(2);
    expect(check!.alternativeSlotsMs).toEqual([hour, 2 * hour]);
  });

  it('returns an empty alternatives list when nothing is available at all', () => {
    const [check] = detectRecurrenceConflicts([0], []);
    expect(check).toEqual({ occurrenceMs: 0, hasConflict: true, alternativeSlotsMs: [] });
  });

  it('rejects a non-positive maxAlternatives', () => {
    expect(() => detectRecurrenceConflicts([0], [0], 0)).toThrow(
      'maxAlternatives must be a positive integer',
    );
  });
});
