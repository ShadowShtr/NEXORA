import { describe, expect, it } from 'vitest';
import { generateRecurrenceOccurrences } from '@/features/appointments/domain/recurrence';

const TZ = 'Europe/Lisbon';

describe('generateRecurrenceOccurrences', () => {
  it('always starts with the first occurrence itself', () => {
    const firstOccurrenceMs = new Date('2026-06-01T09:00:00.000Z').getTime();
    const occurrences = generateRecurrenceOccurrences({
      firstOccurrenceMs,
      timeZone: TZ,
      frequency: 'weekly',
      occurrenceCount: 4,
    });
    expect(occurrences[0]).toBe(firstOccurrenceMs);
    expect(occurrences).toHaveLength(4);
  });

  it('weekly steps 7 days apart, same local time', () => {
    const occurrences = generateRecurrenceOccurrences({
      firstOccurrenceMs: new Date('2026-06-01T09:00:00.000Z').getTime(),
      timeZone: TZ,
      frequency: 'weekly',
      occurrenceCount: 3,
    });
    expect(occurrences.map((ms) => new Date(ms).toISOString())).toEqual([
      '2026-06-01T09:00:00.000Z',
      '2026-06-08T09:00:00.000Z',
      '2026-06-15T09:00:00.000Z',
    ]);
  });

  it('biweekly steps 14 days apart', () => {
    const occurrences = generateRecurrenceOccurrences({
      firstOccurrenceMs: new Date('2026-06-01T09:00:00.000Z').getTime(),
      timeZone: TZ,
      frequency: 'biweekly',
      occurrenceCount: 3,
    });
    expect(occurrences.map((ms) => new Date(ms).toISOString())).toEqual([
      '2026-06-01T09:00:00.000Z',
      '2026-06-15T09:00:00.000Z',
      '2026-06-29T09:00:00.000Z',
    ]);
  });

  it('three_weeks steps 21 days apart', () => {
    const occurrences = generateRecurrenceOccurrences({
      firstOccurrenceMs: new Date('2026-06-01T09:00:00.000Z').getTime(),
      timeZone: TZ,
      frequency: 'three_weeks',
      occurrenceCount: 3,
    });
    expect(occurrences.map((ms) => new Date(ms).toISOString())).toEqual([
      '2026-06-01T09:00:00.000Z',
      '2026-06-22T09:00:00.000Z',
      '2026-07-13T09:00:00.000Z',
    ]);
  });

  it('custom steps by the given number of days', () => {
    const occurrences = generateRecurrenceOccurrences({
      firstOccurrenceMs: new Date('2026-06-01T09:00:00.000Z').getTime(),
      timeZone: TZ,
      frequency: 'custom',
      customIntervalDays: 10,
      occurrenceCount: 3,
    });
    expect(occurrences.map((ms) => new Date(ms).toISOString())).toEqual([
      '2026-06-01T09:00:00.000Z',
      '2026-06-11T09:00:00.000Z',
      '2026-06-21T09:00:00.000Z',
    ]);
  });

  describe('monthly — fim de mês', () => {
    it('clamps to the shorter month but never carries the clamp forward (computed from the original day each time)', () => {
      // 31 May -> 30 Jun (clamped, June has 30 days) -> 31 Jul (back to 31: computed from
      // the original 31, not from June's clamped 30) -> 31 Aug.
      const occurrences = generateRecurrenceOccurrences({
        firstOccurrenceMs: new Date('2026-05-31T08:00:00.000Z').getTime(), // 09:00 WEST
        timeZone: TZ,
        frequency: 'monthly',
        occurrenceCount: 4,
      });
      expect(occurrences.map((ms) => new Date(ms).toISOString())).toEqual([
        '2026-05-31T08:00:00.000Z',
        '2026-06-30T08:00:00.000Z',
        '2026-07-31T08:00:00.000Z',
        '2026-08-31T08:00:00.000Z',
      ]);
    });

    it('a mid-month day never needs clamping', () => {
      const occurrences = generateRecurrenceOccurrences({
        firstOccurrenceMs: new Date('2026-01-15T09:00:00.000Z').getTime(),
        timeZone: TZ,
        frequency: 'monthly',
        occurrenceCount: 3,
      });
      expect(occurrences.map((ms) => new Date(ms).toISOString())).toEqual([
        '2026-01-15T09:00:00.000Z',
        '2026-02-15T09:00:00.000Z',
        '2026-03-15T09:00:00.000Z',
      ]);
    });
  });

  describe('DST — Europe/Lisbon', () => {
    it('spring-forward (2026-03-29): weekly occurrences keep 09:00 local, UTC instant shifts by 1h', () => {
      const occurrences = generateRecurrenceOccurrences({
        firstOccurrenceMs: new Date('2026-03-22T09:00:00.000Z').getTime(), // 09:00 WET
        timeZone: TZ,
        frequency: 'weekly',
        occurrenceCount: 3,
      });
      expect(occurrences.map((ms) => new Date(ms).toISOString())).toEqual([
        '2026-03-22T09:00:00.000Z', // WET (UTC+0)
        '2026-03-29T08:00:00.000Z', // WEST (UTC+1) — transition day
        '2026-04-05T08:00:00.000Z', // WEST (UTC+1)
      ]);
    });

    it('fall-back (2026-10-25): weekly occurrences keep 09:00 local, UTC instant shifts back by 1h', () => {
      const occurrences = generateRecurrenceOccurrences({
        firstOccurrenceMs: new Date('2026-10-18T08:00:00.000Z').getTime(), // 09:00 WEST
        timeZone: TZ,
        frequency: 'weekly',
        occurrenceCount: 3,
      });
      expect(occurrences.map((ms) => new Date(ms).toISOString())).toEqual([
        '2026-10-18T08:00:00.000Z', // WEST (UTC+1)
        '2026-10-25T09:00:00.000Z', // WET (UTC+0) — transition day
        '2026-11-01T09:00:00.000Z', // WET (UTC+0)
      ]);
    });
  });

  describe('validation', () => {
    const base = {
      firstOccurrenceMs: new Date('2026-06-01T09:00:00.000Z').getTime(),
      timeZone: TZ,
    } as const;

    it('rejects an occurrence count below 2', () => {
      expect(() =>
        generateRecurrenceOccurrences({ ...base, frequency: 'weekly', occurrenceCount: 1 }),
      ).toThrow('Occurrence count must be an integer between 2 and 52');
    });

    it('rejects an occurrence count above 52', () => {
      expect(() =>
        generateRecurrenceOccurrences({ ...base, frequency: 'weekly', occurrenceCount: 53 }),
      ).toThrow('Occurrence count must be an integer between 2 and 52');
    });

    it('rejects a non-integer occurrence count', () => {
      expect(() =>
        generateRecurrenceOccurrences({ ...base, frequency: 'weekly', occurrenceCount: 2.5 }),
      ).toThrow('Occurrence count must be an integer between 2 and 52');
    });

    it("rejects frequency='custom' without customIntervalDays", () => {
      expect(() =>
        generateRecurrenceOccurrences({ ...base, frequency: 'custom', occurrenceCount: 3 }),
      ).toThrow('Custom frequency requires an interval between 1 and 52 days');
    });

    it('rejects a customIntervalDays outside 1-52', () => {
      expect(() =>
        generateRecurrenceOccurrences({
          ...base,
          frequency: 'custom',
          customIntervalDays: 53,
          occurrenceCount: 3,
        }),
      ).toThrow('Custom frequency requires an interval between 1 and 52 days');
    });

    it('rejects customIntervalDays on a non-custom frequency', () => {
      expect(() =>
        generateRecurrenceOccurrences({
          ...base,
          frequency: 'weekly',
          customIntervalDays: 10,
          occurrenceCount: 3,
        }),
      ).toThrow("customIntervalDays is only valid for frequency='custom', got 'weekly'");
    });
  });
});
