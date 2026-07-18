import { fromZonedTime } from 'date-fns-tz';
import type { BusyInterval } from './availability';

export type DayHours = Readonly<{
  isOpen: boolean;
  opensAt: string | null;
  closesAt: string | null;
  lunchStartsAt: string | null;
  lunchEndsAt: string | null;
}>;

export type BusinessHoursRow = Readonly<{
  dayOfWeek: number;
  isOpen: boolean;
  opensAt: string | null;
  closesAt: string | null;
  lunchStartsAt: string | null;
  lunchEndsAt: string | null;
}>;

export type BusinessHoursExceptionRow = Readonly<{
  exceptionDate: string;
  isOpen: boolean;
  opensAt: string | null;
  closesAt: string | null;
  lunchStartsAt: string | null;
  lunchEndsAt: string | null;
}>;

// business_hours_exceptions redefines the schedule for one calendar date, taking
// priority over the recurring weekly business_hours row for that date's day_of_week
// (docs/04_DATA_MODEL.md, NEX-060). dateKey is "YYYY-MM-DD" in the tenant's timezone.
export function resolveDayHours(
  dateKey: string,
  dayOfWeek: number,
  weeklyHours: readonly BusinessHoursRow[],
  exceptions: readonly BusinessHoursExceptionRow[],
): DayHours {
  const exception = exceptions.find((row) => row.exceptionDate === dateKey);
  if (exception) {
    return {
      isOpen: exception.isOpen,
      opensAt: exception.opensAt,
      closesAt: exception.closesAt,
      lunchStartsAt: exception.lunchStartsAt,
      lunchEndsAt: exception.lunchEndsAt,
    };
  }

  const weekly = weeklyHours.find((row) => row.dayOfWeek === dayOfWeek);
  if (!weekly)
    return { isOpen: false, opensAt: null, closesAt: null, lunchStartsAt: null, lunchEndsAt: null };

  return {
    isOpen: weekly.isOpen,
    opensAt: weekly.opensAt,
    closesAt: weekly.closesAt,
    lunchStartsAt: weekly.lunchStartsAt,
    lunchEndsAt: weekly.lunchEndsAt,
  };
}

function toUtcMs(dateKey: string, time: string, timeZone: string): number {
  // fromZonedTime interprets "YYYY-MM-DDTHH:MM:SS" as wall-clock time in `timeZone` and
  // resolves the correct UTC instant across the DST transition for that date.
  return fromZonedTime(`${dateKey}T${time}`, timeZone).getTime();
}

// Converts one day's open hours (minus lunch, if any) into the UTC-instant intervals
// during which the business is open. A day with a lunch break yields two intervals.
export function dayHoursToOpenIntervals(
  dateKey: string,
  hours: DayHours,
  timeZone: string,
): BusyInterval[] {
  if (!hours.isOpen || !hours.opensAt || !hours.closesAt) return [];

  const opensMs = toUtcMs(dateKey, hours.opensAt, timeZone);
  const closesMs = toUtcMs(dateKey, hours.closesAt, timeZone);

  if (!hours.lunchStartsAt || !hours.lunchEndsAt) {
    return [{ startMs: opensMs, endMs: closesMs }];
  }

  const lunchStartMs = toUtcMs(dateKey, hours.lunchStartsAt, timeZone);
  const lunchEndMs = toUtcMs(dateKey, hours.lunchEndsAt, timeZone);

  return [
    { startMs: opensMs, endMs: lunchStartMs },
    { startMs: lunchEndMs, endMs: closesMs },
  ];
}
