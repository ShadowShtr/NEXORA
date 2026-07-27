'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth/require-profile';
import type { Result } from '@/lib/result';

const deleteSchema = z.object({ clientId: z.uuid() });

// NEX-163: "Apagar/anonimizar cliente — workflow preserva obrigações e remove
// storage." delete_or_anonymize_client (supabase/migrations/0036) does the SQL-only
// half (decide delete vs. anonymize, scrub PII, remove client_photos rows) and reports
// back which Storage objects to remove — deleting the actual files is Storage-API
// work only a Server Action can reach, not something a Postgres function can do
// itself. tenant_id/authorization live entirely inside the RPC via
// current_tenant_id() — same as every other RPC in this codebase — a clientId from
// another tenant raises 'client not found', never touches anything.
export async function deleteOrAnonymizeClient(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = deleteSchema.safeParse({ clientId: formData.get('clientId') });
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } };
  }

  await requireProfile();
  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc('delete_or_anonymize_client', { p_client_id: parsed.data.clientId })
    .single<{ action: string; storage_paths: string[] }>();

  if (error || !data) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Cliente não encontrada.' } };
  }

  if (data.storage_paths.length > 0) {
    // Best-effort, same reasoning as deleteClientPhoto: the rows are already gone
    // (what every listing/lookup relies on), so a failure here only leaves orphaned,
    // still tenant-scoped objects in Storage rather than an inconsistent UI state.
    await supabase.storage.from('client-photos').remove(data.storage_paths);
  }

  revalidatePath('/dashboard/clientes');
  redirect('/dashboard/clientes');
}
