import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { pt } from 'date-fns/locale/pt';

export type CalendarView = 'day' | 'week' | 'month';

export type CalendarRange = {
  /** UTC instant (ISO) of the range's local start, inclusive. */
  startIso: string;
  /** UTC instant (ISO) of the range's local end, exclusive. */
  endIso: string;
  /** Local date keys ("YYYY-MM-DD") covered by the range, in order. */
  dateKeys: string[];
};

export function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const anchor = new Date(Date.UTC(year!, month! - 1, day! + days, 12));
  return anchor.toISOString().slice(0, 10);
}

// Monday-first week, matching the onboarding hours step's own week-start assumption
// (src/features/onboarding/domain/hours-step.ts uses JS Date.getDay(), 0=Sunday, but a
// business week for a PT nail salon starts Monday) — day 0 (Sunday) maps to an offset
// of 6 back from itself, everything else is dayOfWeek - 1.
function startOfWeekKey(dateKey: string, timezone: string): string {
  const dayOfWeek = fromZonedTime(`${dateKey}T00:00:00`, timezone).getUTCDay();
  const offsetFromMonday = (dayOfWeek + 6) % 7;
  return addDays(dateKey, -offsetFromMonday);
}

function startOfMonthKey(dateKey: string): string {
  const [year, month] = dateKey.split('-').map(Number);
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function daysInMonth(dateKey: string): number {
  const [year, month] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year!, month!, 0)).getUTCDate();
}

// NEX-082: "Navegação eficiente e responsiva" across day/week/month views. Every range
// boundary is resolved via fromZonedTime (same helper the availability engine uses,
// src/features/appointments/domain/daily-schedule.ts) so a range correctly spans a DST
// transition — e.g. the week containing 2026-03-29 (WET->WEST) still starts and ends at
// the right UTC instants for "00:00 local" on its boundary dates.
export function resolveCalendarRange(
  view: CalendarView,
  dateKey: string,
  timezone: string,
): CalendarRange {
  if (view === 'day') {
    const startIso = fromZonedTime(`${dateKey}T00:00:00`, timezone).toISOString();
    const endIso = fromZonedTime(`${addDays(dateKey, 1)}T00:00:00`, timezone).toISOString();
    return { startIso, endIso, dateKeys: [dateKey] };
  }

  if (view === 'week') {
    const weekStart = startOfWeekKey(dateKey, timezone);
    const dateKeys = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const startIso = fromZonedTime(`${weekStart}T00:00:00`, timezone).toISOString();
    const endIso = fromZonedTime(`${addDays(weekStart, 7)}T00:00:00`, timezone).toISOString();
    return { startIso, endIso, dateKeys };
  }

  const monthStart = startOfMonthKey(dateKey);
  const totalDays = daysInMonth(monthStart);
  const dateKeys = Array.from({ length: totalDays }, (_, i) => addDays(monthStart, i));
  const startIso = fromZonedTime(`${monthStart}T00:00:00`, timezone).toISOString();
  const endIso = fromZonedTime(
    `${addDays(monthStart, totalDays)}T00:00:00`,
    timezone,
  ).toISOString();
  return { startIso, endIso, dateKeys };
}

// Navigation step: "anterior"/"seguinte" moves by exactly one unit of the current view
// (a day, a week, or a calendar month), anchored to the range's own start so repeated
// navigation doesn't drift (e.g. always landing on day 1 of the next month, not "same
// day-of-month +30").
export function shiftCalendarDate(view: CalendarView, dateKey: string, direction: 1 | -1): string {
  if (view === 'day') return addDays(dateKey, direction);
  if (view === 'week') return addDays(dateKey, direction * 7);

  const [year, month, day] = dateKey.split('-').map(Number);
  const shifted = new Date(Date.UTC(year!, month! - 1 + direction, Math.min(day!, 28), 12));
  return shifted.toISOString().slice(0, 10);
}

export function formatRangeLabel(
  view: CalendarView,
  dateKeys: readonly string[],
  timezone: string,
): string {
  const first = dateKeys[0]!;
  const last = dateKeys[dateKeys.length - 1]!;
  const anchor = (key: string) => fromZonedTime(`${key}T12:00:00`, timezone);

  if (view === 'day') {
    return formatInTimeZone(anchor(first), timezone, "dd 'de' MMMM, EEEE", { locale: pt });
  }
  if (view === 'week') {
    return `${formatInTimeZone(anchor(first), timezone, 'dd/MM')} – ${formatInTimeZone(anchor(last), timezone, 'dd/MM')}`;
  }
  return formatInTimeZone(anchor(first), timezone, "MMMM 'de' yyyy", { locale: pt });
}
