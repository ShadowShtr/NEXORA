'use server';

import { z } from 'zod';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { computeAvailableSlotsMs } from '@/lib/availability-lookup';
import { detectRecurrenceConflicts } from '@/features/appointments/domain/recurrence-conflicts';
import type { Result } from '@/lib/result';

const requestSchema = z.object({
  // Mirrors generateRecurrenceOccurrences' own occurrenceCount bound (NEX-120,
  // domain/recurrence.ts) — this always receives that function's output.
  occurrencesIso: z.array(z.iso.datetime()).min(2).max(52),
  serviceDurationMinutes: z.number().int().min(5).max(720),
});

export type RecurrenceConflictCheck = Readonly<{
  occurrenceIso: string;
  hasConflict: boolean;
  alternativeSlotsIso: readonly string[];
}>;

// NEX-121: authenticated counterpart to getManualBookingAvailability (NEX-085) — same
// tenantId-from-session boundary, same computeAvailableSlotsMs (NEX-083) call, so a
// recurring occurrence is checked against the exact same notion of "available" the
// single-booking flow already uses. tenantId never comes from input, so this can only
// ever read the caller's own tenant's appointments/blocks/business hours (RLS on top of
// that, same as every other authenticated read in this codebase).
export async function checkRecurrenceConflicts(
  occurrencesIso: string[],
  serviceDurationMinutes: number,
): Promise<Result<{ checks: RecurrenceConflictCheck[] }>> {
  const parsed = requestSchema.safeParse({ occurrencesIso, serviceDurationMinutes });
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

  const availableSlotsMs = await computeAvailableSlotsMs(
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

  const occurrencesMs = parsed.data.occurrencesIso.map((iso) => new Date(iso).getTime());
  const checks = detectRecurrenceConflicts(occurrencesMs, availableSlotsMs).map((check) => ({
    occurrenceIso: new Date(check.occurrenceMs).toISOString(),
    hasConflict: check.hasConflict,
    alternativeSlotsIso: check.alternativeSlotsMs.map((ms) => new Date(ms).toISOString()),
  }));

  return { ok: true, value: { checks } };
}
