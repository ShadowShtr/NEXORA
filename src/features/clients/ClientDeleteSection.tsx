'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { deleteOrAnonymizeClient } from './delete-actions';
import type { Result } from '@/lib/result';

// NEX-163: "Apagar/anonimizar cliente — workflow preserva obrigações e remove
// storage." Same two-step reveal pattern as every other destructive action in this
// app (AppointmentDetailActions.tsx, NEX-084/115/123/143) — never window.confirm().
// hasAppointments decides which outcome the RPC will actually take (delete_or_
// anonymize_client, supabase/migrations/0036), so the confirmation text tells the
// dona the real consequence up front instead of a generic "are you sure".
export function ClientDeleteSection({
  clientId,
  hasAppointments,
}: {
  clientId: string;
  hasAppointments: boolean;
}) {
  const [state, formAction, pending] = useActionState<Result<null> | null, FormData>(
    deleteOrAnonymizeClient,
    null,
  );
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" variant="secondary" onClick={() => setConfirming(true)}>
        Apagar cliente
      </Button>
    );
  }

  return (
    <form action={formAction} className="stack">
      <input type="hidden" name="clientId" value={clientId} />
      <p role="alert">
        {hasAppointments
          ? 'Esta cliente tem marcações associadas. Os dados pessoais (nome, contacto, observações) serão removidos, mas o histórico de marcações e pagamentos é mantido. Esta ação não pode ser desfeita.'
          : 'Esta cliente será apagada por completo, incluindo fotografias. Esta ação não pode ser desfeita.'}
      </p>
      {state && !state.ok ? (
        <p role="alert" className="form-error">
          {state.error.message}
        </p>
      ) : null}
      <div className="wizard-actions">
        <Button type="submit" disabled={pending}>
          {pending
            ? 'A processar…'
            : hasAppointments
              ? 'Sim, remover dados pessoais'
              : 'Sim, apagar'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
