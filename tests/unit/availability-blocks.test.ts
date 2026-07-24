import { describe, expect, it } from 'vitest';
import {
  allDayBlockRange,
  timedBlockRange,
  weeklyRecurringBlockRanges,
} from '@/features/appointments/domain/availability-blocks';

const TZ = 'Europe/Lisbon';

describe('timedBlockRange (pontual)', () => {
  it('resolves a same-day time range to the correct UTC instants', () => {
    const range = timedBlockRange('2026-06-01', '14:00:00', '16:00:00', TZ);
    expect(new Date(range.startsAtMs).toISOString()).toBe('2026-06-01T13:00:00.000Z'); // WEST
    expect(new Date(range.endsAtMs).toISOString()).toBe('2026-06-01T15:00:00.000Z');
  });

  it('rejects an end time at or before the start time', () => {
    expect(() => timedBlockRange('2026-06-01', '16:00:00', '16:00:00', TZ)).toThrow(
      'End time must be after start time',
    );
    expect(() => timedBlockRange('2026-06-01', '17:00:00', '16:00:00', TZ)).toThrow(
      'End time must be after start time',
    );
  });
});

describe('allDayBlockRange (dia inteiro / intervalo / férias)', () => {
  it('a single day (dia inteiro) spans local midnight to the next local midnight', () => {
    const range = allDayBlockRange('2026-06-01', '2026-06-01', TZ);
    expect(new Date(range.startsAtMs).toISOString()).toBe('2026-05-31T23:00:00.000Z'); // WEST
    expect(new Date(range.endsAtMs).toISOString()).toBe('2026-06-01T23:00:00.000Z');
  });

  it('a multi-day range (intervalo/férias) is end-exclusive the day after the last date', () => {
    const range = allDayBlockRange('2026-08-10', '2026-08-15', TZ);
    expect(new Date(range.startsAtMs).toISOString()).toBe('2026-08-09T23:00:00.000Z');
    expect(new Date(range.endsAtMs).toISOString()).toBe('2026-08-15T23:00:00.000Z');
  });

  it('rejects an end date before the start date', () => {
    expect(() => allDayBlockRange('2026-08-15', '2026-08-10', TZ)).toThrow(
      'End date must not be before the start date',
    );
  });

  it('spans a DST spring-forward transition (2026-03-29) correctly', () => {
    const range = allDayBlockRange('2026-03-28', '2026-03-30', TZ);
    // 28th starts WET (UTC+0); 31st (day after the 30th) starts WEST (UTC+1) — the
    // range itself just needs to be the correct absolute UTC instants either side.
    expect(new Date(range.startsAtMs).toISOString()).toBe('2026-03-28T00:00:00.000Z');
    expect(new Date(range.endsAtMs).toISOString()).toBe('2026-03-30T23:00:00.000Z');
  });
});

describe('weeklyRecurringBlockRanges (semanal recorrente)', () => {
  it('generates one range per week, keeping the same local time each week', () => {
    const ranges = weeklyRecurringBlockRanges('2026-06-01', '12:00:00', '14:00:00', TZ, 3);
    expect(ranges).toHaveLength(3);
    expect(ranges.map((r) => new Date(r.startsAtMs).toISOString())).toEqual([
      '2026-06-01T11:00:00.000Z',
      '2026-06-08T11:00:00.000Z',
      '2026-06-15T11:00:00.000Z',
    ]);
    expect(ranges.map((r) => new Date(r.endsAtMs).toISOString())).toEqual([
      '2026-06-01T13:00:00.000Z',
      '2026-06-08T13:00:00.000Z',
      '2026-06-15T13:00:00.000Z',
    ]);
  });

  it('keeps the local time-of-day stable across a DST transition', () => {
    const ranges = weeklyRecurringBlockRanges('2026-03-22', '12:00:00', '14:00:00', TZ, 3);
    // 22nd is WET (UTC+0); 29th is the spring-forward day, already WEST by noon; 5th
    // April is WEST too — local 12:00-14:00 stays fixed, the UTC instant shifts by 1h.
    expect(ranges.map((r) => new Date(r.startsAtMs).toISOString())).toEqual([
      '2026-03-22T12:00:00.000Z',
      '2026-03-29T11:00:00.000Z',
      '2026-04-05T11:00:00.000Z',
    ]);
  });

  it('rejects an occurrence count below 2 or above 52', () => {
    expect(() => weeklyRecurringBlockRanges('2026-06-01', '12:00:00', '14:00:00', TZ, 1)).toThrow(
      'Occurrence count must be an integer between 2 and 52',
    );
    expect(() => weeklyRecurringBlockRanges('2026-06-01', '12:00:00', '14:00:00', TZ, 53)).toThrow(
      'Occurrence count must be an integer between 2 and 52',
    );
  });
});
