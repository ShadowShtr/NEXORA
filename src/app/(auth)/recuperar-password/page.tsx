'use client';

import { useActionState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { requestPasswordReset } from '@/features/auth/actions';
import type { Result } from '@/lib/result';

export default function RequestPasswordResetPage() {
  const [state, formAction, pending] = useActionState<Result<null> | null, FormData>(
    requestPasswordReset,
    null,
  );

  if (state?.ok) {
    return (
      <main className="shell centered">
        <Card className="auth-card">
          <p className="eyebrow">Área da profissional</p>
          <h1>Verifique o seu e-mail</h1>
          <p>
            Se o e-mail introduzido corresponder a uma conta, enviámos um link para definir uma nova
            palavra-passe.
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="shell centered">
      <Card className="auth-card">
        <p className="eyebrow">Área da profissional</p>
        <h1>Recuperar palavra-passe</h1>
        <form className="stack" aria-label="Recuperar palavra-passe" action={formAction}>
          <label>
            E-mail
            <input name="email" type="email" autoComplete="email" required />
          </label>
          {state && !state.ok ? (
            <p role="alert" className="form-error">
              {state.error.message}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? 'A enviar…' : 'Enviar link de recuperação'}
          </Button>
          <a className="link-button" href="/login">
            Voltar a entrar
          </a>
        </form>
      </Card>
    </main>
  );
}
