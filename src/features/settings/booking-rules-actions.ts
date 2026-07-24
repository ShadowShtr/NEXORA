'use server';

import { revalidatePath } from 'next/cache';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { hasAffectedRows } from '@/lib/write-confirmation';
import { rulesStepSchema } from '@/features/onboarding/domain/rules-step';
import type { Result } from '@/lib/result';

// NEX-141: "Defaults e 'usar recomendações'" — the same 5 rules the onboarding wizard's
// RulesStep (NEX-034) sets on first setup, made editable afterward. Reuses that step's
// own schema/option sets (domain/rules-step.ts) so the two never drift on what's a valid
// value. Unlike submitRulesStep (features/onboarding/actions.ts), this never touches
// onboarding_step — that column only tracks wizard progress, irrelevant once the wizard
// is done.
export async function updateBookingRules(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = rulesStepSchema.safeParse({
    slotIntervalMinutes: formData.get('slotIntervalMinutes'),
    bufferMinutes: formData.get('bufferMinutes'),
    minNoticeHours: formData.get('minNoticeHours'),
    bookingWindowDays: formData.get('bookingWindowDays'),
    cancellationNoticeHours: formData.get('cancellationNoticeHours'),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message ?? 'Verifique as regras selecionadas.',
      },
    };
  }

  const { tenantId } = await requireProfile();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('business_settings')
    .update({
      slot_interval_minutes: parsed.data.slotIntervalMinutes,
      buffer_minutes: parsed.data.bufferMinutes,
      min_notice_hours: parsed.data.minNoticeHours,
      booking_window_days: parsed.data.bookingWindowDays,
      cancellation_notice_hours: parsed.data.cancellationNoticeHours,
    })
    .eq('tenant_id', tenantId)
    .select('tenant_id');

  if (error || !hasAffectedRows(data)) {
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar. Tente novamente.' },
    };
  }

  revalidatePath('/dashboard/definicoes/marcacoes');
  return { ok: true, value: null };
}
