'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth/require-profile';
import type { Result } from '@/lib/result';

const cancelSchema = z.object({ appointmentId: z.uuid() });
const rescheduleSchema = z.object({
  appointmentId: z.uuid(),
  newStartAtIso: z.iso.datetime(),
});

// NEX-084: "Ações internas com confirmação e auditoria". Both delegate to
// security-definer RPCs (supabase/migrations/0008_cancel_reschedule_appointment.sql)
// that derive tenant_id from the caller's own session (current_tenant_id()), never
// from a parameter — requireProfile() here only gates page/action access to a
// signed-in owner; the RPC itself is the actual authorization boundary, same pattern
// as publish_business (NEX-035). Confirmation itself lives in the UI (a browser
// confirm() before submitting), not here — the RPC is the record of what happened,
// not the confirmation prompt. useActionState signature (prevState, FormData) matches
// every other dashboard mutation in this codebase (src/features/catalog/actions.ts).
export async function cancelAppointment(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = cancelSchema.safeParse({ appointmentId: formData.get('appointmentId') });
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Marcação inválida.' } };
  }

  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_appointment', {
    p_appointment_id: parsed.data.appointmentId,
  });

  if (error) {
    if (error.code === '22023') {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Esta marcação já não pode ser cancelada.' },
      };
    }
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível cancelar. Tente novamente.' },
    };
  }

  revalidatePath('/dashboard/agenda');
  return { ok: true, value: null };
}

export async function rescheduleAppointment(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = rescheduleSchema.safeParse({
    appointmentId: formData.get('appointmentId'),
    newStartAtIso: formData.get('newStartAtIso'),
  });
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } };
  }

  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc('reschedule_appointment', {
    p_appointment_id: parsed.data.appointmentId,
    p_new_start_at: parsed.data.newStartAtIso,
  });

  if (error) {
    if (error.code === '23P01') {
      return {
        ok: false,
        error: { code: 'SLOT_TAKEN', message: 'Este horário já está ocupado.' },
      };
    }
    if (error.code === '22023') {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Esta marcação já não pode ser reagendada.' },
      };
    }
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível reagendar. Tente novamente.' },
    };
  }

  revalidatePath('/dashboard/agenda');
  return { ok: true, value: null };
}
