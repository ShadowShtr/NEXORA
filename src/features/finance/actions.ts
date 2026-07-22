'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth/require-profile';
import type { Result } from '@/lib/result';

const markPaymentPaidSchema = z.object({
  paymentId: z.uuid(),
  method: z.enum(['cash', 'mbway']),
});

// NEX-114: "Área de pagamentos pendentes" — delegates to mark_payment_paid
// (supabase/migrations/0029_mark_payment_paid.sql), a security-definer RPC that
// derives tenant_id from the caller's own session and only ever advances a payment
// from 'pending' to 'paid' — requireProfile() here only gates page/action access to a
// signed-in owner, same pattern as completeAppointment
// (src/features/appointments/completion-actions.ts).
export async function markPaymentPaid(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = markPaymentPaidSchema.safeParse({
    paymentId: formData.get('paymentId'),
    method: formData.get('method'),
  });
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } };
  }

  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc('mark_payment_paid', {
    p_payment_id: parsed.data.paymentId,
    p_method: parsed.data.method,
  });

  if (error) {
    if (error.code === '22023') {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Este pagamento já não está pendente.' },
      };
    }
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível registar. Tente novamente.' },
    };
  }

  revalidatePath('/dashboard/financeiro');
  revalidatePath('/dashboard/financeiro/pendentes');
  return { ok: true, value: null };
}
