'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { updateClientPreferences } from './actions';
import type { ClientPreferences } from './domain/preferences';
import type { Result } from '@/lib/result';

export function ClientPreferencesForm({
  clientId,
  preferences,
}: {
  clientId: string;
  preferences: ClientPreferences;
}) {
  const [state, formAction, pending] = useActionState<Result<null> | null, FormData>(
    updateClientPreferences,
    null,
  );

  return (
    <form action={formAction} className="stack">
      <input type="hidden" name="clientId" value={clientId} />
      <label>
        Cores preferidas
        <textarea name="colors" defaultValue={preferences.colors} rows={2} maxLength={500} />
      </label>
      <label>
        Formatos preferidos
        <textarea name="formats" defaultValue={preferences.formats} rows={2} maxLength={500} />
      </label>
      <label>
        Técnicas preferidas
        <textarea
          name="techniques"
          defaultValue={preferences.techniques}
          rows={2}
          maxLength={500}
        />
      </label>
      <label>
        Produtos preferidos
        <textarea name="products" defaultValue={preferences.products} rows={2} maxLength={500} />
      </label>
      {state && !state.ok ? (
        <p role="alert" className="form-error">
          {state.error.message}
        </p>
      ) : null}
      {state?.ok ? <p role="status">Preferências guardadas.</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'A guardar…' : 'Guardar preferências'}
      </Button>
    </form>
  );
}
