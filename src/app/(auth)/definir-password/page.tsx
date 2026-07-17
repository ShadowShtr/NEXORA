'use client';

import { useActionState, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { updatePassword } from '@/features/auth/actions';
import type { Result } from '@/lib/result';

type SessionState = 'checking' | 'ready' | 'invalid';

export default function UpdatePasswordPage() {
  const [state, formAction, pending] = useActionState<Result<null> | null, FormData>(
    updatePassword,
    null,
  );
  const [session, setSession] = useState<SessionState>('checking');

  useEffect(() => {
    // Password recovery links use Supabase's implicit flow: tokens arrive in the URL
    // hash fragment (never sent to the server), not a server-exchangeable `?code=`.
    // @supabase/ssr's createBrowserClient hardcodes flowType: "pkce" and does not let
    // it be overridden, so automatic detectSessionInUrl parsing never picks these up —
    // the tokens are parsed and applied manually instead.
    let cancelled = false;

    async function consumeRecoveryLink() {
      const supabase = createClient();
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = hash.get('access_token');
      const refreshToken = hash.get('refresh_token');

      if (hash.get('type') !== 'recovery' || !accessToken || !refreshToken) {
        if (!cancelled) setSession('invalid');
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      window.history.replaceState(null, '', window.location.pathname);
      if (!cancelled) setSession(error ? 'invalid' : 'ready');
    }

    void consumeRecoveryLink();

    return () => {
      cancelled = true;
    };
  }, []);

  if (session === 'checking') {
    return (
      <main className="shell centered">
        <Card className="auth-card">
          <p>A validar o link de recuperação…</p>
        </Card>
      </main>
    );
  }

  if (session === 'invalid') {
    return (
      <main className="shell centered">
        <Card className="auth-card">
          <p className="eyebrow">Área da profissional</p>
          <h1>Link inválido ou expirado</h1>
          <p>Peça um novo link de recuperação.</p>
          <a className="link-button" href="/recuperar-password">
            Pedir novo link
          </a>
        </Card>
      </main>
    );
  }

  return (
    <main className="shell centered">
      <Card className="auth-card">
        <p className="eyebrow">Área da profissional</p>
        <h1>Definir nova palavra-passe</h1>
        <form className="stack" aria-label="Definir nova palavra-passe" action={formAction}>
          <label>
            Nova palavra-passe
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          {state && !state.ok ? (
            <p role="alert" className="form-error">
              {state.error.message}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? 'A guardar…' : 'Guardar palavra-passe'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
