import { addDays, addMonths } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

// NEX-120: "Gerador de recorrências" — approved frequencies per
// docs/01_PRODUCT_REQUIREMENTS.md §7 ("semanal, quinzenal, a cada 3 semanas, mensal ou
// intervalo personalizado"), matching recurring_series.frequency's check constraint
// (supabase/migrations/0001_initial.sql) verbatim so a later task persisting a series
// can write this value straight into that column.
export type RecurrenceFrequency = 'weekly' | 'biweekly' | 'three_weeks' | 'monthly' | 'custom';

const FIXED_INTERVAL_DAYS: Readonly<Record<'weekly' | 'biweekly' | 'three_weeks', number>> = {
  weekly: 7,
  biweekly: 14,
  three_weeks: 21,
};

export type GenerateRecurrenceOccurrencesInput = Readonly<{
  // Instant of the first (already-existing) occurrence — every later occurrence is
  // computed forward from this one, never cumulatively from its predecessor, so
  // rounding/DST quirks on one occurrence can't drift the rest of the series.
  firstOccurrenceMs: number;
  timeZone: string;
  frequency: RecurrenceFrequency;
  // Days between occurrences, only for frequency='custom' — "intervalo personalizado" has
  // no unit in the product doc, so this picks the most literal, generic one (days) rather
  // than inventing an implicit "weeks" reading. Bounded 1-52 to match
  // recurring_series.interval_value's own check constraint, so a later task persisting a
  // custom series can write this value straight into that column without translation.
  // Residual decision, not yet confirmed with product/UI design.
  customIntervalDays?: number;
  // Total series length including the first occurrence. Bounded 2-52 to match
  // recurring_series.occurrence_count's check constraint (0001_initial.sql) — 2 because a
  // one-occurrence "series" is just the normal booking flow, not a recurrence.
  occurrenceCount: number;
}>;

// Returns one UTC instant per occurrence, ascending, always starting with
// firstOccurrenceMs itself. DST-safe and month-end-safe by construction: arithmetic only
// ever touches the *calendar date* (via a UTC-noon anchor, exactly like
// generateTimezoneAwareSlots's dayAnchor in ./availability.ts — never a real wall-clock
// instant on its own), while the original wall-clock time-of-day is re-combined with each
// resulting date and resolved to a UTC instant via fromZonedTime, which picks whatever
// UTC offset is correct for that specific future date. addMonths' own end-of-month
// clamping (e.g. Jan 31 -> Feb 28) handles the monthly "fim de mês" case without any
// custom logic here.
export function generateRecurrenceOccurrences(input: GenerateRecurrenceOccurrencesInput): number[] {
  const { firstOccurrenceMs, timeZone, frequency, customIntervalDays, occurrenceCount } = input;

  if (!Number.isInteger(occurrenceCount) || occurrenceCount < 2 || occurrenceCount > 52) {
    throw new Error('Occurrence count must be an integer between 2 and 52');
  }
  if (frequency === 'custom') {
    if (
      customIntervalDays === undefined ||
      !Number.isInteger(customIntervalDays) ||
      customIntervalDays < 1 ||
      customIntervalDays > 52
    ) {
      throw new Error('Custom frequency requires an interval between 1 and 52 days');
    }
  } else if (customIntervalDays !== undefined) {
    throw new Error(`customIntervalDays is only valid for frequency='custom', got '${frequency}'`);
  }

  const firstDateKey = formatInTimeZone(firstOccurrenceMs, timeZone, 'yyyy-MM-dd');
  const timeOfDay = formatInTimeZone(firstOccurrenceMs, timeZone, 'HH:mm:ss');
  const [year, month, day] = firstDateKey.split('-').map(Number) as [number, number, number];
  // Noon avoids the anchor itself ever landing on a DST-invalid/ambiguous wall-clock
  // instant; only its date fields (Y/M/D) are read back out below.
  const anchor = new Date(Date.UTC(year, month - 1, day, 12));

  const occurrences: number[] = [];
  for (let index = 0; index < occurrenceCount; index += 1) {
    const shifted =
      frequency === 'monthly'
        ? addMonths(anchor, index)
        : addDays(
            anchor,
            index * (frequency === 'custom' ? customIntervalDays! : FIXED_INTERVAL_DAYS[frequency]),
          );
    const dateKey = shifted.toISOString().slice(0, 10);
    occurrences.push(fromZonedTime(`${dateKey}T${timeOfDay}`, timeZone).getTime());
  }

  return occurrences;
}
