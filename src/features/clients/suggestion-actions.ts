'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth/require-profile';
import { normalizePhoneE164 } from '@/lib/phone';
import type { Result } from '@/lib/result';

const requestSchema = z.object({
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(24).optional(),
});

export type ClientSuggestion = { id: string; name: string; phoneE164: string };

// NEX-092: "Busca sugere cliente existente por nome/telemóvel" (docs/01_PRODUCT_REQUIREMENTS.md
// §7) — surfaces existing clients as the owner types a "new" client's details in
// ManualBookingForm (NEX-085), so a client who already exists (perhaps typed with a
// different phone format) doesn't get silently duplicated. "Telefones equivalentes":
// the phone match normalizes the typed value to E.164 first (src/lib/phone.ts, the same
// normalizer create_public_booking/create_manual_booking rely on for the column
// itself) and compares against the stored E.164 value — "911111111" and
// "+351911111111" must surface the same existing client.
//
// tenantId comes only from the caller's own session (requireProfile()) — never from
// input — so this can only ever suggest the owner's own clients, never another
// tenant's ("Sugestões sem expor dados cruzados").
export async function suggestExistingClients(
  name: string,
  phone: string,
): Promise<Result<ClientSuggestion[]>> {
  const parsed = requestSchema.safeParse({ name, phone });
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Pedido inválido.' } };
  }

  const trimmedName = parsed.data.name?.trim() ?? '';
  const trimmedPhone = parsed.data.phone?.trim() ?? '';
  if (trimmedName.length < 2 && trimmedPhone.length < 3) {
    return { ok: true, value: [] };
  }

  const { tenantId } = await requireProfile();
  const supabase = await createClient();

  const normalizedPhone = trimmedPhone ? normalizePhoneE164(trimmedPhone) : null;
  const escapedName = trimmedName.replace(/[%_,()]/g, (char) => `\\${char}`);

  const filters: string[] = [];
  if (trimmedName.length >= 2) filters.push(`name.ilike.%${escapedName}%`);
  if (normalizedPhone) filters.push(`phone_e164.eq.${normalizedPhone}`);
  if (filters.length === 0) {
    return { ok: true, value: [] };
  }

  const { data, error } = await supabase
    .from('clients')
    .select('id, name, phone_e164')
    .eq('tenant_id', tenantId)
    .or(filters.join(','))
    .order('name')
    .limit(5);

  if (error) {
    return { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Não foi possível pesquisar.' } };
  }

  return {
    ok: true,
    value: (data ?? []).map((client) => ({
      id: client.id,
      name: client.name,
      phoneE164: client.phone_e164,
    })),
  };
}
