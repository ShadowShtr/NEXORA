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
const noShowSchema = z.object({ appointmentId: z.uuid() });
const reopenSchema = z.object({ appointmentId: z.uuid() });
const cancelSeriesSchema = z.object({
  appointmentId: z.uuid(),
  scope: z.enum(['this_and_future', 'all']),
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

// NEX-095: "Registar" — the first acceptance criterion of the no-show policy epic.
// appointment_status already had 'no_show' since 0001_initial.sql but nothing could
// ever reach it; mark_appointment_no_show (0011_no_show_policy.sql) mirrors
// cancel_appointment exactly (same status guard, same tenant derivation, same audit
// write), so this action mirrors cancelAppointment above too.
export async function markAppointmentNoShow(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = noShowSchema.safeParse({ appointmentId: formData.get('appointmentId') });
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Marcação inválida.' } };
  }

  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc('mark_appointment_no_show', {
    p_appointment_id: parsed.data.appointmentId,
  });

  if (error) {
    if (error.code === '22023') {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Esta marcação já não pode ser marcada como falta.',
        },
      };
    }
    return {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Não foi possível registar a falta. Tente novamente.',
      },
    };
  }

  revalidatePath('/dashboard/agenda');
  return { ok: true, value: null };
}

// NEX-115: "Reabrir/corrigir com auditoria" — undoes a completion made in error.
// reopen_appointment (supabase/migrations/0031_reopen_appointment.sql) reverts status to
// 'confirmed', drops the manual_extra/discount items the completion added, marks the
// resulting payment 'refunded' (never deletes it), and writes a full snapshot of the
// prior state to audit_logs — same tenant-derivation and authorization boundary as every
// other RPC here.
export async function reopenAppointment(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = reopenSchema.safeParse({ appointmentId: formData.get('appointmentId') });
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Marcação inválida.' } };
  }

  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc('reopen_appointment', {
    p_appointment_id: parsed.data.appointmentId,
  });

  if (error) {
    if (error.code === '22023') {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Esta marcação já não pode ser reaberta.' },
      };
    }
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível reabrir. Tente novamente.' },
    };
  }

  revalidatePath('/dashboard/agenda');
  return { ok: true, value: null };
}

// NEX-123: "Editar escopo da série" — "esta, esta e próximas, ou toda a série". "Esta"
// is exactly cancelAppointment above (unchanged); this covers the two multi-row scopes
// via cancel_recurring_series (0033_cancel_recurring_series_scope.sql), which cancels
// every still-cancellable appointment in the same recurring_series atomically.
export async function cancelRecurringSeries(
  _prevState: Result<{ cancelledCount: number }> | null,
  formData: FormData,
): Promise<Result<{ cancelledCount: number }>> {
  const parsed = cancelSeriesSchema.safeParse({
    appointmentId: formData.get('appointmentId'),
    scope: formData.get('scope'),
  });
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Pedido inválido.' } };
  }

  await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('cancel_recurring_series', {
    p_appointment_id: parsed.data.appointmentId,
    p_scope: parsed.data.scope,
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
  return { ok: true, value: { cancelledCount: data as number } };
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
