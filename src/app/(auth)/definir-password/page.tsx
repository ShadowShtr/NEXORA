'use client';

import { useEffect, useState } from 'react';
import { AuthShell } from '@/features/auth/AuthShell';
import { DefinirPasswordForm } from '@/features/auth/DefinirPasswordForm';
import { createClient } from '@/lib/supabase/client';

type SessionState = 'checking' | 'ready' | 'invalid';

export default function UpdatePasswordPage() {
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
      <AuthShell>
        <p className="login-subtitle" aria-live="polite">
          A validar o link de recuperação…
        </p>
      </AuthShell>
    );
  }

  if (session === 'invalid') {
    return (
      <AuthShell>
        <h1 className="login-title">Link inválido ou expirado</h1>
        <p className="login-subtitle">Peça um novo link de recuperação.</p>
        <footer className="login-footer">
          <a className="login-forgot-link" href="/recuperar-password">
            Pedir novo link
          </a>
        </footer>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <DefinirPasswordForm />
    </AuthShell>
  );
}
