import { formatInTimeZone } from 'date-fns-tz';
import { dateKeyDayOfWeek } from '@/features/appointments/domain/calendar-navigation';

// Full day names for the "ver horário completo" bottom sheet — a distinct convention
// from onboarding/domain/hours-step.ts's DAY_LABELS (short forms for a compact settings
// form); this reference's own example uses the full "-feira" form ("Segunda-feira").
export const FULL_DAY_LABELS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
] as const;

export type BusinessHourRow = {
  dayOfWeek: number;
  isOpen: boolean;
  opensAt: string | null;
  closesAt: string | null;
};

export type TodayHoursSummary = { status: 'open' | 'closed'; label: string };
export type WeeklyHoursLine = { dayLabel: string; hoursLabel: string };

function formatTime(value: string): string {
  return value.slice(0, 5);
}

// Resolves "now" to the tenant's own local calendar day first (formatInTimeZone — a
// request near local midnight must never pick the wrong day), then reads that date
// key's weekday via the shared, DST-safe dateKeyDayOfWeek (calendar-navigation.ts) —
// never a second real timezone conversion, which is exactly what made the previous
// version of this kind of calculation return the wrong weekday during WEST (see that
// function's own comment for the full story).
function localDayOfWeek(nowMs: number, timezone: string): number {
  const dateKey = formatInTimeZone(nowMs, timezone, 'yyyy-MM-dd');
  return dateKeyDayOfWeek(dateKey);
}

// "Aberto hoje · 09:00–19:00" — the day's full scheduled window, not a live
// is-open-this-exact-minute indicator (a business closed for lunch right now is still
// "aberto hoje"), matching the reference's own example.
export function resolveTodayHoursSummary(
  rows: readonly BusinessHourRow[],
  timezone: string,
  nowMs: number,
): TodayHoursSummary {
  const dayOfWeek = localDayOfWeek(nowMs, timezone);
  const today = rows.find((row) => row.dayOfWeek === dayOfWeek);
  if (!today || !today.isOpen || !today.opensAt || !today.closesAt) {
    return { status: 'closed', label: 'Fechado hoje' };
  }
  return {
    status: 'open',
    label: `Aberto hoje · ${formatTime(today.opensAt)}–${formatTime(today.closesAt)}`,
  };
}

export function buildWeeklyHoursLines(rows: readonly BusinessHourRow[]): WeeklyHoursLine[] {
  return Array.from({ length: 7 }, (_, dayOfWeek) => {
    const row = rows.find((entry) => entry.dayOfWeek === dayOfWeek);
    const dayLabel = FULL_DAY_LABELS[dayOfWeek]!;
    if (!row || !row.isOpen || !row.opensAt || !row.closesAt) {
      return { dayLabel, hoursLabel: 'Fechado' };
    }
    return { dayLabel, hoursLabel: `${formatTime(row.opensAt)}–${formatTime(row.closesAt)}` };
  });
}
