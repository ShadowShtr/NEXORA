'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth/require-profile';
import type { Result } from '@/lib/result';

const reminderIdSchema = z.object({ reminderId: z.uuid() });

// NEX-103: both delegate to security-definer RPCs
// (supabase/migrations/0013_reminder_engagement.sql) that derive tenant_id from the
// caller's own session — requireProfile() here only gates page/action access to a
// signed-in owner, same pattern as cancelAppointment (src/features/appointments/detail-actions.ts).
export async function markReminderOpened(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = reminderIdSchema.safeParse({ reminderId: formData.get('reminderId') });
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Lembrete inválido.' } };
  }

  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc('mark_reminder_opened', {
    p_reminder_id: parsed.data.reminderId,
  });

  if (error) {
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível registar. Tente novamente.' },
    };
  }

  revalidatePath('/dashboard/lembretes');
  return { ok: true, value: null };
}

export async function markReminderSent(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = reminderIdSchema.safeParse({ reminderId: formData.get('reminderId') });
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Lembrete inválido.' } };
  }

  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc('mark_reminder_sent', {
    p_reminder_id: parsed.data.reminderId,
  });

  if (error) {
    if (error.code === '22023') {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Este lembrete já não pode ser marcado.' },
      };
    }
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível registar. Tente novamente.' },
    };
  }

  revalidatePath('/dashboard/lembretes');
  return { ok: true, value: null };
}
