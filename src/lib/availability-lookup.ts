import type { SupabaseClient } from '@supabase/supabase-js';
import {
  generateTimezoneAwareSlots,
  type BusyInterval,
} from '@/features/appointments/domain/availability';
import type {
  BusinessHoursExceptionRow,
  BusinessHoursRow,
} from '@/features/appointments/domain/daily-schedule';

export type AvailabilitySettings = {
  timezone: string;
  slotIntervalMinutes: 15 | 30 | 60;
  bufferMinutes: number;
  minNoticeHours: number;
  bookingWindowDays: number;
};

// Shared by getPublicAvailability (NEX-062, anonymous visitor picking a slot) and
// NEX-083's free-slots summary for the owner's own agenda — both need the identical
// business_hours/business_hours_exceptions/availability_blocks/appointments query
// shape and the same generateTimezoneAwareSlots (NEX-061) call, computed from the
// tenant's own business_settings rather than caller input. Extracted here so the two
// call sites can never silently drift on what "available" means — the task's own
// acceptance criteria calls this out explicitly ("Consistência com motor").
export async function computeAvailableSlotsMs(
  client: SupabaseClient,
  tenantId: string,
  settings: AvailabilitySettings,
  serviceDurationMinutes: number,
): Promise<number[]> {
  const nowMs = Date.now();
  const horizonIso = new Date(nowMs + settings.bookingWindowDays * 24 * 60 * 60_000).toISOString();

  const [
    { data: weeklyHoursRows },
    { data: exceptionRows },
    { data: blockRows },
    { data: appointmentRows },
  ] = await Promise.all([
    client
      .from('business_hours')
      .select('day_of_week, is_open, opens_at, closes_at, lunch_starts_at, lunch_ends_at')
      .eq('tenant_id', tenantId),
    client
      .from('business_hours_exceptions')
      .select('exception_date, is_open, opens_at, closes_at, lunch_starts_at, lunch_ends_at')
      .eq('tenant_id', tenantId)
      .gte('exception_date', new Date(nowMs).toISOString().slice(0, 10))
      .lte('exception_date', horizonIso.slice(0, 10)),
    client
      .from('availability_blocks')
      .select('starts_at, ends_at')
      .eq('tenant_id', tenantId)
      .lt('starts_at', horizonIso)
      .gt('ends_at', new Date(nowMs).toISOString()),
    client
      .from('appointments')
      .select('start_at, blocked_until')
      .eq('tenant_id', tenantId)
      .in('status', ['confirmed', 'presence_confirmed'])
      .lt('start_at', horizonIso)
      .gt('blocked_until', new Date(nowMs).toISOString()),
  ]);

  const weeklyHours: BusinessHoursRow[] = (weeklyHoursRows ?? []).map((row) => ({
    dayOfWeek: row.day_of_week,
    isOpen: row.is_open,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    lunchStartsAt: row.lunch_starts_at,
    lunchEndsAt: row.lunch_ends_at,
  }));

  const exceptions: BusinessHoursExceptionRow[] = (exceptionRows ?? []).map((row) => ({
    exceptionDate: row.exception_date,
    isOpen: row.is_open,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    lunchStartsAt: row.lunch_starts_at,
    lunchEndsAt: row.lunch_ends_at,
  }));

  // blocked_until (not end_at) mirrors appointments_no_overlap (0001_initial.sql), which
  // already encodes each appointment's own buffer into that column.
  const busy: BusyInterval[] = [
    ...(blockRows ?? []).map((row) => ({
      startMs: new Date(row.starts_at).getTime(),
      endMs: new Date(row.ends_at).getTime(),
    })),
    ...(appointmentRows ?? []).map((row) => ({
      startMs: new Date(row.start_at).getTime(),
      endMs: new Date(row.blocked_until).getTime(),
    })),
  ];

  return generateTimezoneAwareSlots({
    timeZone: settings.timezone,
    nowMs,
    minNoticeHours: settings.minNoticeHours,
    bookingWindowDays: settings.bookingWindowDays,
    slotStepMinutes: settings.slotIntervalMinutes,
    serviceDurationMinutes,
    bufferMinutes: settings.bufferMinutes,
    weeklyHours,
    exceptions,
    busy,
  });
}
