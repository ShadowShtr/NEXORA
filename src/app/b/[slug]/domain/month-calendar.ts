import { formatInTimeZone } from 'date-fns-tz';
import { pt } from 'date-fns/locale/pt';

export type CalendarDay = {
  dateKey: string;
  dayOfMonth: number;
  inCurrentMonth: boolean;
  hasSlots: boolean;
  isPast: boolean;
};

export type CalendarMonth = {
  /** "yyyy-MM", the month this grid represents. */
  monthKey: string;
  label: string;
  /** Always a multiple of 7 — Sunday-first weeks, padded with adjacent-month days. */
  days: CalendarDay[];
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function monthKeyOf(year: number, month: number): string {
  return `${year}-${pad(month + 1)}`;
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  const anchor = new Date(Date.UTC(year!, month! - 1 + delta, 1));
  return monthKeyOf(anchor.getUTCFullYear(), anchor.getUTCMonth());
}

// Builds a Sunday-first month grid, padded with the tail of the previous month and the
// head of the next so every row has 7 days — the layout every consumer calendar UI
// (this public booking flow) expects, so a click always lands on a real date even near
// the month's edges. `slotDateKeys`/`todayKey` are computed by the caller in the
// tenant's own timezone (this module has no timezone opinion of its own), matching how
// getPublicAvailability/groupSlotsByDay already resolve dates.
export function buildCalendarMonth(
  monthKey: string,
  slotDateKeys: ReadonlySet<string>,
  todayKey: string,
): CalendarMonth {
  const [year, month] = monthKey.split('-').map(Number) as [number, number];
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const firstWeekday = firstOfMonth.getUTCDay(); // 0=Sunday
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const daysInPrevMonth = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();

  const days: CalendarDay[] = [];

  for (let i = firstWeekday - 1; i >= 0; i--) {
    const dayOfMonth = daysInPrevMonth - i;
    const prevMonthDate = new Date(Date.UTC(year, month - 2, dayOfMonth));
    const dateKey = `${prevMonthDate.getUTCFullYear()}-${pad(prevMonthDate.getUTCMonth() + 1)}-${pad(dayOfMonth)}`;
    days.push({
      dateKey,
      dayOfMonth,
      inCurrentMonth: false,
      hasSlots: slotDateKeys.has(dateKey),
      isPast: dateKey < todayKey,
    });
  }

  for (let dayOfMonth = 1; dayOfMonth <= daysInMonth; dayOfMonth++) {
    const dateKey = `${year}-${pad(month)}-${pad(dayOfMonth)}`;
    days.push({
      dateKey,
      dayOfMonth,
      inCurrentMonth: true,
      hasSlots: slotDateKeys.has(dateKey),
      isPast: dateKey < todayKey,
    });
  }

  let nextDay = 1;
  while (days.length % 7 !== 0) {
    const nextMonthDate = new Date(Date.UTC(year, month, nextDay));
    const dateKey = `${nextMonthDate.getUTCFullYear()}-${pad(nextMonthDate.getUTCMonth() + 1)}-${pad(nextMonthDate.getUTCDate())}`;
    days.push({
      dateKey,
      dayOfMonth: nextMonthDate.getUTCDate(),
      inCurrentMonth: false,
      hasSlots: slotDateKeys.has(dateKey),
      isPast: dateKey < todayKey,
    });
    nextDay++;
  }

  const label = formatInTimeZone(firstOfMonth, 'UTC', 'MMMM yyyy', { locale: pt });

  return { monthKey, label: label.charAt(0).toUpperCase() + label.slice(1), days };
}
