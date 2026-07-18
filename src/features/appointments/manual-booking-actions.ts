'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth/require-profile';
import { clientContactSchema } from '@/lib/validation/client';
import type { Result } from '@/lib/result';

const requestSchema = z
  .object({
    clientId: z.uuid().nullable(),
    clientName: z.string().trim().optional(),
    clientPhone: z.string().trim().optional(),
    clientEmail: z.string().trim().optional(),
    selectedServiceIds: z.array(z.uuid()),
    selectedPackageId: z.uuid().nullable(),
    startAtIso: z.iso.datetime(),
    observation: z.string().trim().max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    // NEX-092: an existing client (picked from the owner's own list) needs no further
    // contact fields; a brand-new client still goes through the same E.164/name
    // validation the public flow uses (clientContactSchema).
    if (data.clientId) return;
    const parsed = clientContactSchema.safeParse({
      name: data.clientName ?? '',
      phone: data.clientPhone ?? '',
      email: data.clientEmail ?? '',
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({ code: 'custom', message: issue.message, path: ['clientName'] });
      }
    }
  });

// NEX-085: "Cliente, itens, slot, valor, observação" — delegates to
// create_manual_booking (supabase/migrations/0009_create_manual_booking.sql), which
// derives tenant_id from the caller's own session and re-prices every item from the
// live catalog, same authority boundary as every other appointment-mutating RPC in
// this codebase (NEX-064, NEX-084).
export async function createManualBooking(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const rawClientId = formData.get('clientId');
  const parsed = requestSchema.safeParse({
    clientId: rawClientId ? String(rawClientId) : null,
    clientName: formData.get('clientName') ?? undefined,
    clientPhone: formData.get('clientPhone') ?? undefined,
    clientEmail: formData.get('clientEmail') ?? undefined,
    selectedServiceIds: formData.getAll('selectedServiceIds').map(String),
    selectedPackageId: formData.get('selectedPackageId') || null,
    startAtIso: formData.get('startAtIso'),
    observation: formData.get('observation') ?? undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
      },
    };
  }

  await requireProfile();
  const supabase = await createClient();

  let normalizedPhone: string | null = null;
  let normalizedEmail: string | null = null;
  if (!parsed.data.clientId) {
    const contact = clientContactSchema.parse({
      name: parsed.data.clientName,
      phone: parsed.data.clientPhone,
      email: parsed.data.clientEmail ?? '',
    });
    normalizedPhone = contact.phone;
    normalizedEmail = contact.email || null;
  }

  const { data: appointmentId, error } = await supabase.rpc('create_manual_booking', {
    p_client_id: parsed.data.clientId,
    p_client_name: parsed.data.clientId ? null : (parsed.data.clientName ?? null),
    p_client_phone_e164: parsed.data.clientId ? null : normalizedPhone,
    p_client_email: parsed.data.clientId ? null : normalizedEmail,
    p_selected_service_ids: parsed.data.selectedServiceIds,
    p_selected_package_id: parsed.data.selectedPackageId,
    p_start_at: parsed.data.startAtIso,
    p_client_observation: parsed.data.observation ?? null,
  });

  if (error) {
    if (error.code === '23P01') {
      return { ok: false, error: { code: 'SLOT_TAKEN', message: 'Este horário já está ocupado.' } };
    }
    if (error.code === '22023' || error.code === '22004') {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } };
    }
    return {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Não foi possível criar a marcação. Tente novamente.',
      },
    };
  }

  revalidatePath('/dashboard/agenda');
  redirect(`/dashboard/agenda/${appointmentId as string}`);
}
