'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth/require-profile';
import { clientPreferencesSchema } from './domain/preferences';
import { hasAffectedRows } from '@/lib/write-confirmation';
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

  if (error || !hasAffectedRows(data)) {
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar. Tente novamente.' },
    };
  }

  revalidatePath(`/dashboard/clientes/${parsed.data.clientId}`);
  return { ok: true, value: null };
}

const updatePrivateNotesSchema = z.object({
  clientId: z.uuid(),
  privateNotes: z.string().trim().max(2000),
});

// NEX-093: "Editar com auditoria e limites" — delegates to
// update_client_private_notes (supabase/migrations/0010_update_client_private_notes.sql),
// which derives tenant_id from the caller's own session (never a parameter) and writes
// an audit_logs row recording that the note changed, without duplicating the note's
// contents into that broadly-readable, append-only log (docs/05_SECURITY_PRIVACY.md
// "T8 Logs com PII"). React/JSX escapes all rendered text by default (no
// dangerouslySetInnerHTML anywhere this value is displayed), so the note is safe to
// store and render verbatim — the 2000-char limit here mirrors the RPC's own check as
// a fast client-visible failure, not the actual enforcement boundary.
export async function updateClientPrivateNotes(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = updatePrivateNotesSchema.safeParse({
    clientId: formData.get('clientId'),
    privateNotes: formData.get('privateNotes') ?? '',
  });
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } };
  }

  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_client_private_notes', {
    p_client_id: parsed.data.clientId,
    p_private_notes: parsed.data.privateNotes,
  });

  if (error) {
    if (error.code === '22023') {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Cliente não encontrada.' } };
    }
    if (error.code === '22001') {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Observação demasiado longa.' },
      };
    }
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar. Tente novamente.' },
    };
  }

  revalidatePath(`/dashboard/clientes/${parsed.data.clientId}`);
  return { ok: true, value: null };
}
