import { formatInTimeZone } from 'date-fns-tz';
import {
  dayHoursToOpenIntervals,
  resolveDayHours,
  type BusinessHoursExceptionRow,
  type BusinessHoursRow,
  type DayHours,
} from './daily-schedule';

export type BusyInterval = Readonly<{ startMs: number; endMs: number }>;

export type GenerateSlotsInput = Readonly<{
  windowStartMs: number;
  windowEndMs: number;
  slotStepMinutes: 15 | 30 | 60;
  serviceDurationMinutes: number;
  bufferMinutes: number;
  busy: readonly BusyInterval[];
}>;

export function generateAvailableSlots(input: GenerateSlotsInput): number[] {
  const {
    windowStartMs,
    windowEndMs,
    slotStepMinutes,
    serviceDurationMinutes,
    bufferMinutes,
    busy,
  } = input;

  if (windowEndMs <= windowStartMs) throw new Error('Invalid availability window');
  if (serviceDurationMinutes <= 0) throw new Error('Service duration must be positive');
  if (bufferMinutes < 0) throw new Error('Buffer cannot be negative');

  const stepMs = slotStepMinutes * 60_000;
  const occupiedMs = (serviceDurationMinutes + bufferMinutes) * 60_000;
  const slots: number[] = [];

  for (let start = windowStartMs; start + occupiedMs <= windowEndMs; start += stepMs) {
    const end = start + occupiedMs;
    const overlaps = busy.some((interval) => start < interval.endMs && end > interval.startMs);
    if (!overlaps) slots.push(start);
  }

  return slots;
}

export type GenerateTimezoneAwareSlotsInput = Readonly<{
  timeZone: string;
  nowMs: number;
  minNoticeHours: number;
  bookingWindowDays: number;
  slotStepMinutes: 15 | 30 | 60;
  serviceDurationMinutes: number;
  bufferMinutes: number;
  weeklyHours: readonly BusinessHoursRow[];
  exceptions: readonly BusinessHoursExceptionRow[];
  busy: readonly BusyInterval[];
  // NEX-216: lets a provider-aware caller (multi-resource-availability.ts) resolve each
  // day's hours against the provider's own schedule (falling back to the business's,
  // NEX-213's resolveProviderDayHours) instead of the tenant's business_hours directly
  // — same day-walking/DST-safety logic either way, only *which* hours apply differs.
  // Defaults to the plain resolveDayHours(dateKey, dayOfWeek, weeklyHours, exceptions)
  // every existing caller already relies on.
  resolveHours?: (
    dateKey: string,
    dayOfWeek: number,
    weeklyHours: readonly BusinessHoursRow[],
    exceptions: readonly BusinessHoursExceptionRow[],
  ) => DayHours;
}>;

// Orchestrates NEX-061: walks each calendar day (in the tenant's timezone) inside
// [now + min_notice_hours, now + booking_window_days], resolves that day's open
// intervals (business_hours_exceptions takes priority over business_hours, per
// NEX-060/docs/04_DATA_MODEL.md), and generates slots per open interval via
// generateAvailableSlots — which already subtracts `busy` (existing appointments and
// availability_blocks, merged by the caller). Walking day-by-day and converting each
// day's local wall-clock hours through fromZonedTime (daily-schedule.ts) is what makes
// this correct across a DST transition, unlike a single UTC window ignorant of the
// tenant's calendar day boundaries.
export function generateTimezoneAwareSlots(input: GenerateTimezoneAwareSlotsInput): number[] {
  const {
    timeZone,
    nowMs,
    minNoticeHours,
    bookingWindowDays,
    slotStepMinutes,
    serviceDurationMinutes,
    bufferMinutes,
    weeklyHours,
    exceptions,
    busy,
    resolveHours = resolveDayHours,
  } = input;

  if (bookingWindowDays <= 0) throw new Error('Booking window must be positive');
  if (minNoticeHours < 0) throw new Error('Min notice cannot be negative');

  const earliestMs = nowMs + minNoticeHours * 60 * 60_000;
  const horizonMs = nowMs + bookingWindowDays * 24 * 60 * 60_000;

  // formatInTimeZone reads calendar fields via Intl in `timeZone`, independent of the
  // host process's own timezone (unlike Date getters on a toZonedTime() result) — this
  // process may run under any TZ in CI or production.
  const todayKey = formatInTimeZone(nowMs, timeZone, 'yyyy-MM-dd');
  const todayYear = Number(todayKey.slice(0, 4));
  const todayMonth = Number(todayKey.slice(5, 7));
  const todayDate = Number(todayKey.slice(8, 10));
  const slots: number[] = [];

  for (let offset = 0; offset <= bookingWindowDays; offset += 1) {
    // A UTC-noon anchor for day arithmetic only (never used as a wall-clock instant):
    // stepping by whole days here can never cross a DST boundary within the same
    // UTC day, so this stays offset-free and safe to feed back into date formatting.
    const dayAnchor = new Date(Date.UTC(todayYear, todayMonth - 1, todayDate + offset, 12));
    const dateKey = dayAnchor.toISOString().slice(0, 10);
    const dayOfWeek = dayAnchor.getUTCDay();

    const dayHours = resolveHours(dateKey, dayOfWeek, weeklyHours, exceptions);
    const openIntervals = dayHoursToOpenIntervals(dateKey, dayHours, timeZone);

    for (const interval of openIntervals) {
      // Bug found while writing NEX-205's E2E coverage (docs/10_RISK_REGISTER.md, R13):
      // when `earliestMs` (now + aviso mínimo), not the business's opening time, decides
      // where a day's window starts — the normal case for "today", whenever there are
      // still open hours left — the very first slot used to sit at the exact millisecond
      // `Date.now()` happened to be called, not rounded to `slotStepMinutes`. Two separate
      // calls a few seconds apart (e.g. fetching availability, then re-checking a
      // recurring series' conflicts) would almost never agree on that exact instant, so
      // "today"'s slot(s) constantly looked like false conflicts against themselves, and
      // an owner's UI could show an odd time like "16:43" instead of "16:30"/"17:00".
      // Anchoring the grid at `interval.startMs` (the same reference every other day's
      // window already uses) and rounding *up* to the next mark on it keeps every slot on
      // the same grid regardless of which day decided the window's start — a no-op when
      // `interval.startMs` is already binding (unchanged for every day beyond the notice
      // window), and a real fix only for the day(s) still inside it.
      const stepMs = slotStepMinutes * 60_000;
      const rawStartMs = Math.max(interval.startMs, earliestMs);
      const stepsFromIntervalStart = Math.ceil((rawStartMs - interval.startMs) / stepMs);
      const windowStartMs = interval.startMs + stepsFromIntervalStart * stepMs;
      const windowEndMs = Math.min(interval.endMs, horizonMs);
      if (windowEndMs <= windowStartMs) continue;

      const daySlots = generateAvailableSlots({
        windowStartMs,
        windowEndMs,
        slotStepMinutes,
        serviceDurationMinutes,
        bufferMinutes,
        busy,
      });
      slots.push(...daySlots);
    }
  }

  return slots;
}
