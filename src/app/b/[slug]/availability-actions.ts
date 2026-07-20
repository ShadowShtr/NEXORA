'use server';

import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeAvailableSlotsMs } from '@/lib/availability-lookup';
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
// not something spoofed via input. computeAvailableSlotsMs (src/lib/availability-lookup.ts)
// is the shared query+compute step also used by NEX-083's owner-facing free-slots
// summary, so the two never drift on what "available" means.
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

  const slotsMs = await computeAvailableSlotsMs(
    admin,
    tenantId,
    {
      timezone: settings.timezone,
      slotIntervalMinutes: settings.slot_interval_minutes as 15 | 30 | 60,
      bufferMinutes: settings.buffer_minutes,
      minNoticeHours: settings.min_notice_hours,
      bookingWindowDays: settings.booking_window_days,
    },
    serviceDurationMinutes,
  );

  return { ok: true, value: { slotsIso: slotsMs.map((ms) => new Date(ms).toISOString()) } };
}
