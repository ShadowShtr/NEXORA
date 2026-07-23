'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth/require-profile';
import { hasAffectedRows } from '@/lib/write-confirmation';
import {
  INSTAGRAM_HANDLE_PATTERN,
  normalizeInstagramHandle,
  publicProfileSchema,
} from './domain/public-profile';
import type { Result } from '@/lib/result';

// Visual refinement — página pública inicial (/b/[slug]): specialty/about/Instagram/
// booking_enabled are a plain per-tenant settings row the owner writes directly to
// (same pattern as updateNoShowPolicy/updateReminderTemplate) — RLS (via
// createClient(), cookie-scoped) is the actual authorization boundary. No
// revalidatePath for the public page itself: it reads business_settings directly on
// every request (a Supabase server client forces dynamic rendering), so there is no
// cache to invalidate there — same reasoning every catalog action already follows.
export async function updatePublicProfile(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const instagramHandle = normalizeInstagramHandle(String(formData.get('instagramHandle') ?? ''));
  const parsed = publicProfileSchema.safeParse({
    specialty: formData.get('specialty') ?? '',
    aboutDescription: formData.get('aboutDescription') ?? '',
    instagramHandle,
    bookingEnabled: formData.get('bookingEnabled') === 'on',
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message ?? 'Verifique os dados introduzidos.',
      },
    };
  }
  if (parsed.data.instagramHandle && !INSTAGRAM_HANDLE_PATTERN.test(parsed.data.instagramHandle)) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Instagram inválido. Use apenas letras, números, pontos e underscores.',
      },
    };
  }

  const { tenantId } = await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('business_settings')
    .update({
      specialty: parsed.data.specialty || null,
      about_description: parsed.data.aboutDescription || null,
      instagram_handle: parsed.data.instagramHandle || null,
      booking_enabled: parsed.data.bookingEnabled,
    })
    .eq('tenant_id', tenantId)
    .select('tenant_id');

  if (error || !hasAffectedRows(data)) {
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar. Tente novamente.' },
    };
  }

  revalidatePath('/dashboard/definicoes');
  return { ok: true, value: null };
}
