import { addDays } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

// NEX-124: "Bloqueios completos — pontual, semanal, dia, intervalo e férias". All five
// reduce to one shared primitive already in the schema (availability_blocks: a
// [starts_at, ends_at) UTC instant range, tenant.timezone-relative — 0001_initial.sql):
// "dia" is a 1-day "intervalo", "férias" is an "intervalo" with a fixed reason, and
// "pontual"/"semanal" are exact time ranges on one or more specific dates. Same
// UTC-noon-anchor + fromZonedTime pattern as generateTimezoneAwareSlots
// (./availability.ts) and generateRecurrenceOccurrences (./recurrence.ts): calendar
// arithmetic only ever touches the date part, and fromZonedTime resolves the correct
// UTC offset for that specific date, so this stays correct across DST transitions.
export type AvailabilityBlockRange = Readonly<{ startsAtMs: number; endsAtMs: number }>;

function toUtcMs(dateKey: string, time: string, timeZone: string): number {
  return fromZonedTime(`${dateKey}T${time}`, timeZone).getTime();
}

function shiftDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number) as [number, number, number];
  const anchor = new Date(Date.UTC(year, month - 1, day, 12));
  return addDays(anchor, days).toISOString().slice(0, 10);
}

// Pontual: an exact time range within a single calendar day.
export function timedBlockRange(
  dateKey: string,
  startTime: string,
  endTime: string,
  timeZone: string,
): AvailabilityBlockRange {
  const startsAtMs = toUtcMs(dateKey, startTime, timeZone);
  const endsAtMs = toUtcMs(dateKey, endTime, timeZone);
  if (endsAtMs <= startsAtMs) {
    throw new Error('End time must be after start time');
  }
  return { startsAtMs, endsAtMs };
}

// Dia inteiro (firstDateKey === lastDateKey) / Intervalo / Férias: one or more whole
// calendar days, end-exclusive at local midnight the day after lastDateKey.
export function allDayBlockRange(
  firstDateKey: string,
  lastDateKey: string,
  timeZone: string,
): AvailabilityBlockRange {
  if (lastDateKey < firstDateKey) {
    throw new Error('End date must not be before the start date');
  }
  return {
    startsAtMs: toUtcMs(firstDateKey, '00:00:00', timeZone),
    endsAtMs: toUtcMs(shiftDateKey(lastDateKey, 1), '00:00:00', timeZone),
  };
}

// Semanal recorrente: the same time range repeated weekly, starting on firstDateKey, for
// occurrenceCount weeks. Bounded 2-52 to match generateRecurrenceOccurrences'
// occurrenceCount (./recurrence.ts, NEX-120) — a "recorrente" block of 1 is just a
// pontual block instead.
export function weeklyRecurringBlockRanges(
  firstDateKey: string,
  startTime: string,
  endTime: string,
  timeZone: string,
  occurrenceCount: number,
): AvailabilityBlockRange[] {
  if (!Number.isInteger(occurrenceCount) || occurrenceCount < 2 || occurrenceCount > 52) {
    throw new Error('Occurrence count must be an integer between 2 and 52');
  }
  const ranges: AvailabilityBlockRange[] = [];
  for (let index = 0; index < occurrenceCount; index += 1) {
    const dateKey = shiftDateKey(firstDateKey, index * 7);
    ranges.push(timedBlockRange(dateKey, startTime, endTime, timeZone));
  }
  return ranges;
}
