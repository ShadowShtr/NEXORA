'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { updateClientPrivateNotes } from './actions';
import type { Result } from '@/lib/result';

// NEX-093: "Editar com auditoria e limites" — auditoria is written server-side by
// update_client_private_notes (0010_update_client_private_notes.sql), not here; this
// component is just the form. React/JSX escapes {privateNotes} on render by default,
// so a note containing "<script>" or similar renders as inert text, never executes.
export function ClientPrivateNotesForm({
  clientId,
  privateNotes,
}: {
  clientId: string;
  privateNotes: string;
}) {
  const [state, formAction, pending] = useActionState<Result<null> | null, FormData>(
    updateClientPrivateNotes,
    null,
  );

  return (
    <form action={formAction} className="stack">
      <input type="hidden" name="clientId" value={clientId} />
      <label>
        Observações privadas
        <textarea
          name="privateNotes"
          defaultValue={privateNotes}
          rows={4}
          maxLength={2000}
          aria-describedby="private-notes-hint"
        />
      </label>
      <p id="private-notes-hint" className="public-service-meta">
        Só visível para si. Nunca é partilhada com a cliente.
      </p>
      {state && !state.ok ? (
        <p role="alert" className="form-error">
          {state.error.message}
        </p>
      ) : null}
      {state?.ok ? <p role="status">Observações guardadas.</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'A guardar…' : 'Guardar observações'}
      </Button>
    </form>
  );
}
