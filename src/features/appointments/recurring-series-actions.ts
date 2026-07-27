'use server';

import { revalidatePath } from 'next/cache';
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
    frequency: z.enum(['weekly', 'biweekly', 'three_weeks', 'monthly', 'custom']),
    intervalValue: z.number().int().min(1).max(52),
    // Already resolved client-side: generateRecurrenceOccurrences (NEX-120) generates
    // the candidates and the owner may have replaced/dropped conflicting ones
    // (checkRecurrenceConflicts, NEX-121) before reaching this action.
    occurrencesIso: z.array(z.iso.datetime()).min(2).max(52),
    observation: z.string().trim().max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    // Same "existing client needs nothing else, new client needs the same contact
    // validation the public flow uses" rule as createManualBooking (NEX-092).
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

// NEX-122: "Criar série atomicamente" — delegates to create_recurring_series
// (supabase/migrations/0032_create_recurring_series.sql), which inserts the
// recurring_series row and every occurrence's appointment in one transaction: any
// occurrence hitting appointments_no_overlap (a slot taken since the conflict review,
// NEX-121) aborts the whole call, so the owner never ends up with a half-created series
// — same SLOT_TAKEN handling as createManualBooking, just meaning "at least one
// occurrence" here rather than "the one slot".
//
// Visual refinement mid-2026 (Nova marcação wizard): returns the series id instead of
// redirecting server-side, so the wizard can show its own success screen first — same
// reasoning as createManualBooking. There's no single "the" appointment to deep link to
// for a series, so the success screen links to the agenda list instead.
export async function createRecurringSeries(
  _prevState: Result<{ seriesId: string }> | null,
  formData: FormData,
): Promise<Result<{ seriesId: string }>> {
  const rawClientId = formData.get('clientId');
  const parsed = requestSchema.safeParse({
    clientId: rawClientId ? String(rawClientId) : null,
    clientName: formData.get('clientName') ?? undefined,
    clientPhone: formData.get('clientPhone') ?? undefined,
    clientEmail: formData.get('clientEmail') ?? undefined,
    selectedServiceIds: formData.getAll('selectedServiceIds').map(String),
    selectedPackageId: formData.get('selectedPackageId') || null,
    frequency: formData.get('frequency'),
    intervalValue: Number(formData.get('intervalValue')),
    occurrencesIso: formData.getAll('occurrencesIso').map(String),
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

  const { data: seriesId, error } = await supabase.rpc('create_recurring_series', {
    p_client_id: parsed.data.clientId,
    p_client_name: parsed.data.clientId ? null : (parsed.data.clientName ?? null),
    p_client_phone_e164: parsed.data.clientId ? null : normalizedPhone,
    p_client_email: parsed.data.clientId ? null : normalizedEmail,
    p_selected_service_ids: parsed.data.selectedServiceIds,
    p_selected_package_id: parsed.data.selectedPackageId,
    p_frequency: parsed.data.frequency,
    p_interval_value: parsed.data.intervalValue,
    p_occurrence_starts_at: parsed.data.occurrencesIso,
    p_client_observation: parsed.data.observation ?? null,
  });

  if (error) {
    if (error.code === '23P01') {
      return {
        ok: false,
        error: {
          code: 'SLOT_TAKEN',
          message:
            'Pelo menos uma das datas já está ocupada. Reveja os conflitos e tente novamente.',
        },
      };
    }
    if (error.code === '22023' || error.code === '22004') {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } };
    }
    return {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Não foi possível criar a série. Tente novamente.',
      },
    };
  }

  revalidatePath('/dashboard/agenda');
  return { ok: true, value: { seriesId: seriesId as string } };
}
