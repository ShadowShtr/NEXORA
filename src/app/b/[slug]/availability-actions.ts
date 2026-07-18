'use server';

import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  generateTimezoneAwareSlots,
  type BusyInterval,
} from '@/features/appointments/domain/availability';
import type {
  BusinessHoursExceptionRow,
  BusinessHoursRow,
} from '@/features/appointments/domain/daily-schedule';
import type { Result } from '@/lib/result';
import { checkAvailabilityRateLimit } from '@/lib/rate-limit';
import { getRequestIp } from '@/lib/request-ip';

const requestSchema = z.object({
  tenantId: z.uuid(),
  serviceDurationMinutes: z.number().int().min(5).max(720),
});

export type AvailabilityRequest = z.infer<typeof requestSchema>;

// Public consultation of computed slots for the anonymous booking page (NEX-062). Never
// exposes the raw schedule (business_hours, business_hours_exceptions,
// availability_blocks, appointments) to the caller — only the resulting instants, same
// boundary the RLS comment in docs/04_DATA_MODEL.md anticipates for this task. Uses the
// service-role client (src/lib/supabase/admin.ts) because none of those source tables
// carry an `anon` policy; every value that shapes the result (timezone, slot interval,
// buffer, notice, window) is read from the tenant's own business_settings, never taken
// from the caller, so a request can only ever compute that tenant's real availability —
// not something spoofed via input.
export async function getPublicAvailability(
  request: AvailabilityRequest,
): Promise<Result<{ slotsIso: string[] }>> {
  const parsed = requestSchema.safeParse(request);
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Pedido inválido.' } };
  }
  const { tenantId, serviceDurationMinutes } = parsed.data;

  const ip = await getRequestIp();
  const rateLimit = await checkAvailabilityRateLimit(ip);
  if (rateLimit.limited) {
    return {
      ok: false,
      error: { code: 'RATE_LIMITED', message: 'Demasiados pedidos. Tente novamente em breve.' },
    };
  }

  const admin = createAdminClient();

  const { data: tenant } = await admin
    .from('tenants')
    .select('id')
    .eq('id', tenantId)
    .eq('status', 'active')
    .maybeSingle();
  if (!tenant) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Negócio não encontrado.' } };
  }

  const { data: settings } = await admin
    .from('business_settings')
    .select(
      'timezone, slot_interval_minutes, buffer_minutes, min_notice_hours, booking_window_days',
    )
    .eq('tenant_id', tenantId)
    .not('published_at', 'is', null)
    .maybeSingle();
  if (!settings) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Negócio não encontrado.' } };
  }

  const nowMs = Date.now();
  const horizonIso = new Date(
    nowMs + settings.booking_window_days * 24 * 60 * 60_000,
  ).toISOString();

  const [
    { data: weeklyHoursRows },
    { data: exceptionRows },
    { data: blockRows },
    { data: appointmentRows },
  ] = await Promise.all([
    admin
      .from('business_hours')
      .select('day_of_week, is_open, opens_at, closes_at, lunch_starts_at, lunch_ends_at')
      .eq('tenant_id', tenantId),
    admin
      .from('business_hours_exceptions')
      .select('exception_date, is_open, opens_at, closes_at, lunch_starts_at, lunch_ends_at')
      .eq('tenant_id', tenantId)
      .gte('exception_date', new Date(nowMs).toISOString().slice(0, 10))
      .lte('exception_date', horizonIso.slice(0, 10)),
    admin
      .from('availability_blocks')
      .select('starts_at, ends_at')
      .eq('tenant_id', tenantId)
      .lt('starts_at', horizonIso)
      .gt('ends_at', new Date(nowMs).toISOString()),
    admin
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

  const slotStepMinutes = settings.slot_interval_minutes as 15 | 30 | 60;

  const slotsMs = generateTimezoneAwareSlots({
    timeZone: settings.timezone,
    nowMs,
    minNoticeHours: settings.min_notice_hours,
    bookingWindowDays: settings.booking_window_days,
    slotStepMinutes,
    serviceDurationMinutes,
    bufferMinutes: settings.buffer_minutes,
    weeklyHours,
    exceptions,
    busy,
  });

  return { ok: true, value: { slotsIso: slotsMs.map((ms) => new Date(ms).toISOString()) } };
}
