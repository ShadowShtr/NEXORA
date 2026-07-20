'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth/require-profile';
import { resolvePaymentFromChoice } from './domain/completion';
import type { Result } from '@/lib/result';

const manualExtraSchema = z.object({
  description: z.string().trim().min(1).max(200),
  unitPriceCents: z.number().int().min(0),
});

const completeSchema = z.object({
  appointmentId: z.uuid(),
  finalTotalCents: z.coerce.number().int().min(0),
  paymentChoice: z.enum(['cash', 'mbway', 'pending']),
  extraServiceIds: z.array(z.uuid()),
  manualExtras: z.array(manualExtraSchema),
  discountType: z.enum(['fixed', 'percent']).nullable(),
  discountValue: z.number().positive().nullable(),
  discountReason: z.string().trim().max(200),
});

// NEX-110/NEX-111/NEX-112/NEX-113: delegates to complete_appointment
// (supabase/migrations/0017_complete_appointment_discount.sql), a security-definer RPC
// that derives tenant_id from the caller's own session and updates
// appointment/payment/appointment_items/audit_logs atomically — requireProfile() here
// only gates page/action access to a signed-in owner, same pattern as
// cancelAppointment (src/features/appointments/detail-actions.ts). finalTotalCents
// arrives already converted to cents by the client (parseEurosToCents,
// domain/completion.ts) — this action does not re-parse euro strings, it only
// re-validates the integer bound. extraServiceIds/manualExtras/discount* are
// re-validated for shape here (never trusted from the client past that), the RPC
// itself re-prices every service extra from the live catalog, validates every manual
// extra's amount/length, and clamps the discount so it can never exceed the final
// total ("total nunca negativo") — this is defense in depth, not the actual
// authorization boundary.
export async function completeAppointment(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const rawExtraServiceIds = String(formData.get('extraServiceIds') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  let rawManualExtras: unknown = [];
  try {
    rawManualExtras = JSON.parse(String(formData.get('manualExtras') ?? '[]'));
  } catch {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } };
  }

  const rawDiscountType = formData.get('discountType');
  const rawDiscountValue = formData.get('discountValue');

  const parsed = completeSchema.safeParse({
    appointmentId: formData.get('appointmentId'),
    finalTotalCents: formData.get('finalTotalCents'),
    paymentChoice: formData.get('paymentChoice'),
    extraServiceIds: rawExtraServiceIds,
    manualExtras: rawManualExtras,
    discountType: rawDiscountType === '' || rawDiscountType === null ? null : rawDiscountType,
    discountValue:
      rawDiscountValue === '' || rawDiscountValue === null ? null : Number(rawDiscountValue),
    discountReason: formData.get('discountReason') ?? '',
  });
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } };
  }
  if ((parsed.data.discountType === null) !== (parsed.data.discountValue === null)) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Desconto inválido.' } };
  }
  if (parsed.data.discountType === 'percent' && parsed.data.discountValue! > 100) {
    return {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'O desconto percentual não pode exceder 100%.' },
    };
  }

  const payment = resolvePaymentFromChoice(parsed.data.paymentChoice);

  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc('complete_appointment', {
    p_appointment_id: parsed.data.appointmentId,
    p_final_total_cents: parsed.data.finalTotalCents,
    p_payment_status: payment.status,
    p_payment_method: payment.method,
    p_extra_service_ids:
      parsed.data.extraServiceIds.length > 0 ? parsed.data.extraServiceIds : null,
    p_manual_extras: parsed.data.manualExtras.length > 0 ? parsed.data.manualExtras : null,
    p_discount_type: parsed.data.discountType,
    p_discount_value: parsed.data.discountValue,
    p_discount_reason: parsed.data.discountReason.length > 0 ? parsed.data.discountReason : null,
  });

  if (error) {
    if (error.code === '22023') {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Esta marcação já não pode ser concluída.' },
      };
    }
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível concluir. Tente novamente.' },
    };
  }

  revalidatePath('/dashboard/agenda');
  revalidatePath('/dashboard');
  return { ok: true, value: null };
}
