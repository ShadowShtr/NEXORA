'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth/require-profile';
import { resolvePaymentFromChoice } from './domain/completion';
import type { Result } from '@/lib/result';

const completeSchema = z.object({
  appointmentId: z.uuid(),
  finalTotalCents: z.coerce.number().int().min(0),
  paymentChoice: z.enum(['cash', 'mbway', 'pending']),
});

// NEX-110/NEX-113: delegates to complete_appointment
// (supabase/migrations/0015_complete_appointment.sql), a security-definer RPC that
// derives tenant_id from the caller's own session and updates
// appointment/payment/audit_logs atomically — requireProfile() here only gates
// page/action access to a signed-in owner, same pattern as cancelAppointment
// (src/features/appointments/detail-actions.ts). finalTotalCents arrives already
// converted to cents by the client (parseEurosToCents, domain/completion.ts) — this
// action does not re-parse euro strings, it only re-validates the integer bound.
export async function completeAppointment(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = completeSchema.safeParse({
    appointmentId: formData.get('appointmentId'),
    finalTotalCents: formData.get('finalTotalCents'),
    paymentChoice: formData.get('paymentChoice'),
  });
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } };
  }

  const payment = resolvePaymentFromChoice(parsed.data.paymentChoice);

  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc('complete_appointment', {
    p_appointment_id: parsed.data.appointmentId,
    p_final_total_cents: parsed.data.finalTotalCents,
    p_payment_status: payment.status,
    p_payment_method: payment.method,
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
