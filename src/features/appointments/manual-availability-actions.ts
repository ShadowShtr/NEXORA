'use server';

import { z } from 'zod';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { computeAvailableSlotsMs } from '@/lib/availability-lookup';
import type { Result } from '@/lib/result';

const requestSchema = z.object({ serviceDurationMinutes: z.number().int().min(5).max(720) });

// NEX-085's slot picker for manual bookings — authenticated counterpart to
// getPublicAvailability (NEX-062). tenantId comes only from the caller's own session
// (requireProfile()), never from input, so this can only ever compute the owner's own
// tenant's availability. Reuses computeAvailableSlotsMs (src/lib/availability-lookup.ts,
// NEX-083) so this never drifts from what the public booking page or the agenda's
// free-slots summary would compute for the same inputs.
export async function getManualBookingAvailability(
  serviceDurationMinutes: number,
): Promise<Result<{ slotsIso: string[] }>> {
  const parsed = requestSchema.safeParse({ serviceDurationMinutes });
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Pedido inválido.' } };
  }

  const { tenantId } = await requireProfile();
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from('business_settings')
    .select(
      'timezone, slot_interval_minutes, buffer_minutes, min_notice_hours, booking_window_days',
    )
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!settings) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Negócio não encontrado.' } };
  }

  const slotsMs = await computeAvailableSlotsMs(
    supabase,
    tenantId,
    {
      timezone: settings.timezone,
      slotIntervalMinutes: settings.slot_interval_minutes as 15 | 30 | 60,
      bufferMinutes: settings.buffer_minutes,
      minNoticeHours: settings.min_notice_hours,
      bookingWindowDays: settings.booking_window_days,
    },
    parsed.data.serviceDurationMinutes,
  );

  return { ok: true, value: { slotsIso: slotsMs.map((ms) => new Date(ms).toISOString()) } };
}
