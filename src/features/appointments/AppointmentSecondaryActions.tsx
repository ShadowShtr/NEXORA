'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { reopenAppointment } from './detail-actions';
import type { Result } from '@/lib/result';

// Visual refinement mid-2026 (Detalhes da marcação) — "Ações secundárias" as discrete
// chips instead of full-width buttons competing visually with Reagendar/WhatsApp.
// "Duplicar" used to only show for a completed appointment (tied to canReopen, which
// never made sense — wanting to book "another one like this" isn't specific to
// already-finished appointments) — now always available whenever there's a client to
// pre-fill. "Editar marcação" from the reference isn't included: there is no
// service/price editor for an existing appointment, only reschedule (already its own
// primary action) — inventing a link with nowhere real to go would violate the same
// rule this app already follows elsewhere (CLAUDE.md: no fabricated destinations).
export function AppointmentSecondaryActions({
  appointmentId,
  clientId,
  phoneE164,
  canReopen,
}: {
  appointmentId: string;
  clientId: string | null;
  phoneE164: string | null;
  canReopen: boolean;
}) {
  const [reopenState, reopenFormAction, reopenPending] = useActionState<
    Result<null> | null,
    FormData
  >(reopenAppointment, null);
  const [confirmingReopen, setConfirmingReopen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyContact() {
    if (!phoneE164) return;
    try {
      await navigator.clipboard.writeText(phoneE164);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be denied by the browser (permissions, insecure context) —
      // silently doing nothing is the safest fallback, the phone number is already
      // visible on the page for a manual copy either way.
    }
  }

  if (reopenState?.ok) {
    return <p role="status">Marcação reaberta. Pode corrigir e concluir novamente.</p>;
  }

  return (
    <div className="booking-secondary-actions">
      {clientId ? (
        <Link href={`/dashboard/clientes/${clientId}`} className="booking-secondary-action">
          Ver cliente
        </Link>
      ) : null}
      {clientId ? (
        <Link
          href={`/dashboard/agenda/nova?clientId=${clientId}`}
          className="booking-secondary-action"
        >
          Duplicar
        </Link>
      ) : null}
      {phoneE164 ? (
        <button
          type="button"
          className="booking-secondary-action"
          onClick={() => void copyContact()}
        >
          {copied ? 'Copiado!' : 'Copiar contacto'}
        </button>
      ) : null}
      {canReopen ? (
        <Link href="/dashboard/financeiro/pendentes" className="booking-secondary-action">
          Ver pagamentos pendentes
        </Link>
      ) : null}

      {canReopen ? (
        !confirmingReopen ? (
          <button
            type="button"
            className="booking-secondary-action"
            onClick={() => setConfirmingReopen(true)}
          >
            Reabrir marcação
          </button>
        ) : (
          <form action={reopenFormAction} className="booking-reopen-confirm">
            <input type="hidden" name="appointmentId" value={appointmentId} />
            {reopenState && !reopenState.ok ? (
              <p role="alert" className="form-error">
                {reopenState.error.message}
              </p>
            ) : null}
            <p className="text-support">
              Reabrir remove extras/descontos aplicados no fecho e marca o pagamento como estornado.
              Poderá corrigir e concluir novamente.
            </p>
            <div className="wizard-actions">
              <Button type="button" variant="secondary" onClick={() => setConfirmingReopen(false)}>
                Voltar
              </Button>
              <Button type="submit" disabled={reopenPending}>
                {reopenPending ? 'A reabrir…' : 'Sim, reabrir'}
              </Button>
            </div>
          </form>
        )
      ) : null}
    </div>
  );
}
