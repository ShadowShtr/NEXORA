'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { completeAppointment } from './completion-actions';
import { parseEurosToCents, type QuickPaymentChoice } from './domain/completion';
import type { Result } from '@/lib/result';

function formatEurosInputValue(cents: number): string {
  return (cents / 100).toFixed(2);
}

// NEX-110: "janela rápida mostra valor e forma de pagamento... em poucos toques"
// (docs/01_PRODUCT_REQUIREMENTS.md §9) — an inline reveal-in-place panel, the same
// pattern already used for cancel/reschedule/mark-no-show (AppointmentDetailActions.tsx)
// rather than a new overlay/dialog component. The value field is pre-filled with the
// expected total but always adjustable ("preços selecionados são base; valor final é
// ajustável") — the actual authority on what's a valid final value is
// complete_appointment (0015_complete_appointment.sql), this is only a fast path for
// the common case.
export function AppointmentCompletionPanel({
  appointmentId,
  expectedTotalCents,
}: {
  appointmentId: string;
  expectedTotalCents: number;
}) {
  const [state, formAction, pending] = useActionState<Result<null> | null, FormData>(
    completeAppointment,
    null,
  );
  const [open, setOpen] = useState(false);
  const [amountInput, setAmountInput] = useState(formatEurosInputValue(expectedTotalCents));
  const [choice, setChoice] = useState<QuickPaymentChoice | null>(null);

  if (state?.ok) {
    return <p role="status">Atendimento concluído.</p>;
  }

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Concluir
      </Button>
    );
  }

  const parsedCents = parseEurosToCents(amountInput);

  return (
    <form action={formAction} className="stack completion-panel">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input type="hidden" name="finalTotalCents" value={parsedCents ?? ''} />
      <label>
        Valor final (€)
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={amountInput}
          onChange={(event) => setAmountInput(event.target.value)}
        />
      </label>
      <div className="completion-panel-choices">
        <Button
          type="button"
          variant={choice === 'cash' ? 'primary' : 'secondary'}
          onClick={() => setChoice('cash')}
        >
          Dinheiro
        </Button>
        <Button
          type="button"
          variant={choice === 'mbway' ? 'primary' : 'secondary'}
          onClick={() => setChoice('mbway')}
        >
          MB WAY
        </Button>
        <Button
          type="button"
          variant={choice === 'pending' ? 'primary' : 'secondary'}
          onClick={() => setChoice('pending')}
        >
          Pendente
        </Button>
      </div>
      <input type="hidden" name="paymentChoice" value={choice ?? ''} />
      {state && !state.ok ? (
        <p role="alert" className="form-error">
          {state.error.message}
        </p>
      ) : null}
      {parsedCents === null ? (
        <p role="alert" className="form-error">
          Valor inválido.
        </p>
      ) : null}
      <div className="wizard-actions">
        <Button type="submit" disabled={pending || !choice || parsedCents === null}>
          {pending ? 'A concluir…' : 'Confirmar conclusão'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Voltar
        </Button>
      </div>
    </form>
  );
}
