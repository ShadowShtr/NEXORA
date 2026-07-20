'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { updateNoShowPolicy } from './no-show-policy-actions';
import type { Result } from '@/lib/result';

// NEX-095: "Política configurável de faltas" — a limit of null disables the policy
// entirely (no alert ever shown); this is alert-only, never automatic blocking, so the
// only fields here are the threshold and the lookback window.
export function NoShowPolicyForm({
  noShowLimit,
  noShowWindowDays,
}: {
  noShowLimit: number | null;
  noShowWindowDays: number;
}) {
  const [state, formAction, pending] = useActionState<Result<null> | null, FormData>(
    updateNoShowPolicy,
    null,
  );

  return (
    <form action={formAction} className="stack">
      <label>
        Alertar a partir de quantas faltas
        <select name="noShowLimit" defaultValue={noShowLimit ?? ''}>
          <option value="">Desligado</option>
          <option value="2">2 faltas</option>
          <option value="3">3 faltas</option>
          <option value="4">4 faltas</option>
          <option value="5">5 faltas</option>
        </select>
      </label>
      <label>
        Período considerado
        <select name="noShowWindowDays" defaultValue={noShowWindowDays}>
          <option value="30">Últimos 30 dias</option>
          <option value="60">Últimos 60 dias</option>
          <option value="90">Últimos 90 dias</option>
          <option value="180">Últimos 180 dias</option>
        </select>
      </label>
      <p className="text-support">
        Quando o limite é atingido, a ficha da cliente mostra um aviso. Nenhuma marcação é bloqueada
        automaticamente — a decisão é sempre sua.
      </p>
      {state && !state.ok ? (
        <p role="alert" className="form-error">
          {state.error.message}
        </p>
      ) : null}
      {state?.ok ? <p role="status">Política guardada.</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'A guardar…' : 'Guardar política de faltas'}
      </Button>
    </form>
  );
}
