import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import {
  addDays,
  formatRangeLabel,
  resolveCalendarRange,
  shiftCalendarDate,
  type CalendarRange,
  type CalendarView,
} from '@/features/appointments/domain/calendar-navigation';

export type FinancePeriodView = CalendarView | 'custom';

// A custom range is user-supplied (URL query params), so it's clamped to a sane upper
// bound the same way any other untrusted boundary input would be — this is not a
// product decision about how far back financeiro can be viewed, just a guard against a
// crafted URL asking for a multi-decade range in one query.
const CUSTOM_RANGE_MAX_DAYS = 366;

// "Personalizado" (NEX-131) — resolves like resolveCalendarRange's day/week/month
// cases (fromZonedTime for DST-safe local-midnight boundaries), but for an arbitrary
// caller-supplied [from, to] pair instead of one of the three fixed views. Swaps
// from/to if given backwards and clamps the span, rather than erroring — a mis-ordered
// or too-wide range from the URL is still a valid request, just resolved defensively.
export function resolveCustomRange(
  fromKey: string,
  toKey: string,
  timezone: string,
): CalendarRange {
  let start = fromKey <= toKey ? fromKey : toKey;
  let end = fromKey <= toKey ? toKey : fromKey;

  const dateKeys: string[] = [];
  let cursor = start;
  while (cursor <= end && dateKeys.length < CUSTOM_RANGE_MAX_DAYS) {
    dateKeys.push(cursor);
    cursor = addDays(cursor, 1);
  }
  start = dateKeys[0]!;
  end = dateKeys[dateKeys.length - 1]!;

  const startIso = fromZonedTime(`${start}T00:00:00`, timezone).toISOString();
  const endIso = fromZonedTime(`${addDays(end, 1)}T00:00:00`, timezone).toISOString();
  return { startIso, endIso, dateKeys };
}

export type FinancePeriod = {
  view: FinancePeriodView;
  dateKey: string;
  range: CalendarRange;
};

// The comparison period (NEX-130's "comparação com o período anterior") is always the
// immediately preceding span of the same length — yesterday for "hoje", the prior
// Mon-Sun for "esta semana", the prior calendar month for "este mês", and for a custom
// range, the same number of days immediately before it.
export function resolvePreviousRange(period: FinancePeriod, timezone: string): CalendarRange {
  if (period.view === 'custom') {
    const spanDays = period.range.dateKeys.length;
    const previousEnd = addDays(period.range.dateKeys[0]!, -1);
    const previousStart = addDays(previousEnd, -(spanDays - 1));
    return resolveCustomRange(previousStart, previousEnd, timezone);
  }
  const previousDateKey = shiftCalendarDate(period.view, period.dateKey, -1);
  return resolveCalendarRange(period.view, previousDateKey, timezone);
}

// day/week/month reuse the agenda's own range-label formatting (calendar-navigation.ts)
// for cross-page consistency; "custom" has no equivalent there, so it's formatted the
// same way the week view already is ("dd/MM – dd/MM") since that's the closest existing
// convention for "a short span of days" in this app.
export function formatFinanceRangeLabel(period: FinancePeriod, timezone: string): string {
  if (period.view === 'custom') {
    const first = period.range.dateKeys[0]!;
    const last = period.range.dateKeys[period.range.dateKeys.length - 1]!;
    const anchor = (key: string) => fromZonedTime(`${key}T12:00:00`, timezone);
    return `${formatInTimeZone(anchor(first), timezone, 'dd/MM')} – ${formatInTimeZone(anchor(last), timezone, 'dd/MM')}`;
  }
  return formatRangeLabel(period.view, period.range.dateKeys, timezone);
}

export function summaryTitle(view: FinancePeriodView): string {
  if (view === 'day') return 'Resumo de hoje';
  if (view === 'week') return 'Resumo da semana';
  if (view === 'month') return 'Resumo do mês';
  return 'Resumo do período';
}
