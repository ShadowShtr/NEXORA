import {
  resolveDayHours,
  type BusinessHoursExceptionRow,
  type BusinessHoursRow,
  type DayHours,
} from './daily-schedule';

// NEX-213: "Prestador sem horário próprio herda o horário do negócio por omissão" —
// resolved per day-of-week, not all-or-nothing: a provider can define hours for some
// days (e.g. a special Saturday) while every other day quietly falls back to the
// tenant's own business_hours/business_hours_exceptions, exactly as if the provider
// had no schedule of their own for that specific day. `provider_business_hours` having
// zero rows at all for a provider is just the simplest case of this same rule (every
// day falls back), not a separate code path.
export function resolveProviderDayHours(
  dateKey: string,
  dayOfWeek: number,
  providerWeeklyHours: readonly BusinessHoursRow[],
  providerExceptions: readonly BusinessHoursExceptionRow[],
  tenantWeeklyHours: readonly BusinessHoursRow[],
  tenantExceptions: readonly BusinessHoursExceptionRow[],
): DayHours {
  const hasProviderException = providerExceptions.some((row) => row.exceptionDate === dateKey);
  const hasProviderWeeklyRow = providerWeeklyHours.some((row) => row.dayOfWeek === dayOfWeek);

  if (hasProviderException || hasProviderWeeklyRow) {
    return resolveDayHours(dateKey, dayOfWeek, providerWeeklyHours, providerExceptions);
  }

  // Neither an exception nor a weekly row for this specific day — inherit the
  // business's own schedule for it, exceptions included.
  return resolveDayHours(dateKey, dayOfWeek, tenantWeeklyHours, tenantExceptions);
}
