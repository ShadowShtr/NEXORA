'use client';

import { useActionState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { login } from '@/features/auth/actions';
import type { Result } from '@/lib/result';

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<Result<null> | null, FormData>(login, null);

  return (
    <main className="shell centered">
      <Card className="auth-card">
        <p className="eyebrow">Área da profissional</p>
        <h1>Entrar</h1>
        <form className="stack" aria-label="Iniciar sessão" action={formAction}>
          <label>
            E-mail
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Palavra-passe
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          {state && !state.ok ? (
            <p role="alert" className="form-error">
              {state.error.message}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? 'A entrar…' : 'Entrar'}
          </Button>
          <a className="link-button" href="/recuperar-password">
            Esqueceu-se da palavra-passe?
          </a>
        </form>
      </Card>
    </main>
  );
}
