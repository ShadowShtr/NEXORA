'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth/require-profile';
import { clientPreferencesSchema } from './domain/preferences';
import type { Result } from '@/lib/result';

const updatePreferencesSchema = z.object({
  clientId: z.uuid(),
  colors: z.string().trim().max(500),
  formats: z.string().trim().max(500),
  techniques: z.string().trim().max(500),
  products: z.string().trim().max(500),
});

// NEX-091: RLS (via createClient(), cookie-scoped) is the actual authorization
// boundary — an UPDATE against a client row outside the caller's tenant simply matches
// zero rows rather than needing an explicit tenant_id check here, same as every other
// authenticated mutation on a tenant-scoped table in this codebase (src/features/catalog/actions.ts).
export async function updateClientPreferences(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = updatePreferencesSchema.safeParse({
    clientId: formData.get('clientId'),
    colors: formData.get('colors') ?? '',
    formats: formData.get('formats') ?? '',
    techniques: formData.get('techniques') ?? '',
    products: formData.get('products') ?? '',
  });
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } };
  }

  const preferences = clientPreferencesSchema.parse({
    colors: parsed.data.colors,
    formats: parsed.data.formats,
    techniques: parsed.data.techniques,
    products: parsed.data.products,
  });

  await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('clients')
    .update({ preferences })
    .eq('id', parsed.data.clientId)
    .select('id');

  if (error || !data || data.length === 0) {
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar. Tente novamente.' },
    };
  }

  revalidatePath(`/dashboard/clientes/${parsed.data.clientId}`);
  return { ok: true, value: null };
}
