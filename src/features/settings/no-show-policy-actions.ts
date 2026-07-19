'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth/require-profile';
import type { Result } from '@/lib/result';

const updateNoShowPolicySchema = z.object({
  noShowLimit: z.union([z.literal(''), z.coerce.number().int().min(2).max(5)]),
  noShowWindowDays: z.coerce.number().int(),
});

// NEX-095: business_settings is a plain per-tenant settings row the owner writes
// directly to (same pattern as onboarding's moveStep in src/features/onboarding/actions.ts),
// not a security-definer RPC — RLS (via createClient(), cookie-scoped) is the actual
// authorization boundary here, same as updateClientPreferences. An empty
// noShowLimit means "policy off" (stored as null), matching the migration's default.
export async function updateNoShowPolicy(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const rawLimit = formData.get('noShowLimit');
  const parsed = updateNoShowPolicySchema.safeParse({
    noShowLimit: rawLimit === null || rawLimit === '' ? '' : rawLimit,
    noShowWindowDays: formData.get('noShowWindowDays'),
  });
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } };
  }
  if (![30, 60, 90, 180].includes(parsed.data.noShowWindowDays)) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Janela inválida.' } };
  }

  const { tenantId } = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from('business_settings')
    .update({
      no_show_limit: parsed.data.noShowLimit === '' ? null : parsed.data.noShowLimit,
      no_show_window_days: parsed.data.noShowWindowDays,
    })
    .eq('tenant_id', tenantId);

  if (error) {
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar. Tente novamente.' },
    };
  }

  revalidatePath('/dashboard/definicoes');
  return { ok: true, value: null };
}
