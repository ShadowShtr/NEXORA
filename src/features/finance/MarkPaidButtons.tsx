'use client';

import { useActionState } from 'react';
import { markPaymentPaid } from './actions';
import type { Result } from '@/lib/result';

// NEX-114: "marcar como pago; forma de pagamento." Two quick actions, no separate
// confirm step — recording a real-world payment is additive and reversible in spirit
// (a mistake here is a data-entry correction, not a destructive action), same treatment
// already given to "marcar enviado" on the lembretes list.
export function MarkPaidButtons({ paymentId }: { paymentId: string }) {
  const [state, formAction, pending] = useActionState<Result<null> | null, FormData>(
    markPaymentPaid,
    null,
  );

  return (
    <div className="pending-payment-actions">
      <form action={formAction}>
        <input type="hidden" name="paymentId" value={paymentId} />
        <input type="hidden" name="method" value="cash" />
        <button type="submit" className="pending-payment-mark-button" disabled={pending}>
          Dinheiro
        </button>
      </form>
      <form action={formAction}>
        <input type="hidden" name="paymentId" value={paymentId} />
        <input type="hidden" name="method" value="mbway" />
        <button type="submit" className="pending-payment-mark-button" disabled={pending}>
          MB WAY
        </button>
      </form>
      {state && !state.ok ? (
        <p role="alert" className="form-error pending-payment-error">
          {state.error.message}
        </p>
      ) : null}
    </div>
  );
}
