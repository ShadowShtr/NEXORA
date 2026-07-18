'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import {
  decryptDraftPayload,
  encryptDraftPayload,
  generateResumeToken,
  hashResumeToken,
} from '@/lib/booking-draft-crypto';
import { draftPayloadSchema, type DraftPayload } from '@/app/b/[slug]/domain/draft';
import type { Result } from '@/lib/result';

const DRAFT_LIFETIME_MS = 24 * 60 * 60 * 1000;

// Anonymous public visitor, no session to scope by — uses the service-role client
// (src/lib/supabase/admin.ts), never exposed to the browser. tenantId is validated
// against a real, active tenant before anything is written.
//
// existingToken, when present, is reused: the same row is updated in place instead of
// inserting a new one on every autosave. Without this, a single visit that toggles a
// few checkboxes would leave a trail of orphaned rows behind (only the latest token is
// ever kept in localStorage, so earlier rows would never be resumed — and therefore
// never lazily cleaned up — CLAUDE.md: "não guardar rascunhos abandonados
// indefinidamente"). expires_at is only ever set on the initial insert: the
// `expires_at <= created_at + interval '24 hours'` constraint is anchored to the
// original created_at, so it is never touched on update.
export async function saveBookingDraft(
  tenantId: string,
  existingToken: string | null,
  payload: DraftPayload,
): Promise<Result<{ resumeToken: string }>> {
  const parsed = draftPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } };
  }

  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from('tenants')
    .select('id')
    .eq('id', tenantId)
    .eq('status', 'active')
    .maybeSingle();
  if (!tenant) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Negócio não encontrado.' } };
  }

  const encryptedPayload = encryptDraftPayload(parsed.data);

  if (existingToken) {
    const { data: updated } = await admin
      .from('booking_drafts')
      .update({ encrypted_payload: encryptedPayload })
      .eq('resume_token_hash', hashResumeToken(existingToken))
      .eq('tenant_id', tenantId)
      .gt('expires_at', new Date().toISOString())
      .select('id')
      .maybeSingle();
    if (updated) {
      return { ok: true, value: { resumeToken: existingToken } };
    }
  }

  const resumeToken = generateResumeToken();
  const { error } = await admin.from('booking_drafts').insert({
    tenant_id: tenantId,
    resume_token_hash: hashResumeToken(resumeToken),
    encrypted_payload: encryptedPayload,
    expires_at: new Date(Date.now() + DRAFT_LIFETIME_MS).toISOString(),
  });
  if (error) {
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar. Tente novamente.' },
    };
  }

  return { ok: true, value: { resumeToken } };
}

export async function resumeBookingDraft(resumeToken: string): Promise<Result<DraftPayload>> {
  if (!resumeToken) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Link inválido.' } };
  }

  const admin = createAdminClient();
  const { data: draft } = await admin
    .from('booking_drafts')
    .select('id, encrypted_payload, expires_at')
    .eq('resume_token_hash', hashResumeToken(resumeToken))
    .maybeSingle();

  if (!draft) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Rascunho não encontrado.' } };
  }

  if (new Date(draft.expires_at).getTime() < Date.now()) {
    // Lazy cleanup: an expired draft is deleted the moment anything tries to touch it,
    // instead of lingering indefinitely (CLAUDE.md: no abandoned drafts kept forever).
    await admin.from('booking_drafts').delete().eq('id', draft.id);
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Este rascunho expirou.' } };
  }

  try {
    const payload = decryptDraftPayload<DraftPayload>(draft.encrypted_payload);
    return { ok: true, value: payload };
  } catch {
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível recuperar o rascunho.' },
    };
  }
}
