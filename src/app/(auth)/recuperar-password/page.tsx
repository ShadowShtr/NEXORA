'use client';

import { useActionState, useId } from 'react';
import { Mail, MailCheck } from 'lucide-react';
import { AuthShell } from '@/features/auth/AuthShell';
import { requestPasswordReset } from '@/features/auth/actions';
import type { Result } from '@/lib/result';

export default function RequestPasswordResetPage() {
  const [state, formAction, pending] = useActionState<Result<null> | null, FormData>(
    requestPasswordReset,
    null,
  );
  const emailId = useId();

  if (state?.ok) {
    return (
      <AuthShell>
        <span className="appointment-success-icon" aria-hidden="true">
          <MailCheck size={22} />
        </span>
        <h1 className="login-title">Verifique o seu e-mail</h1>
        <p className="login-subtitle">
          Enviámos uma ligação de recuperação, caso exista uma conta associada a este endereço.
        </p>
        <footer className="login-footer">
          <a className="login-forgot-link" href="/login">
            Voltar a entrar
          </a>
        </footer>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="login-title">Recuperar acesso</h1>
      <p className="login-subtitle">Introduza o e-mail associado à sua conta.</p>

      <form className="login-form" aria-label="Recuperar palavra-passe" action={formAction}>
        <div className="form-field">
          <label className="login-label" htmlFor={emailId}>
            E-mail
          </label>
          <div className="login-input-wrapper">
            <Mail className="login-input-icon" aria-hidden="true" size={19} />
            <input
              id={emailId}
              name="email"
              type="email"
              inputMode="email"
              className="login-input"
              autoComplete="email"
              placeholder="nome@exemplo.pt"
              required
              aria-invalid={state && !state.ok ? true : undefined}
            />
          </div>
        </div>

        {state && !state.ok ? (
          <p role="alert" className="form-error login-form-alert">
            {state.error.message}
          </p>
        ) : null}

        <button
          type="submit"
          className="login-submit-button"
          disabled={pending}
          data-loading={pending || undefined}
        >
          {pending ? (
            <>
              <span className="login-submit-spinner" aria-hidden="true" />A enviar…
            </>
          ) : (
            'Enviar ligação de recuperação'
          )}
        </button>

        <div className="login-forgot-row login-forgot-row-center">
          <a className="login-forgot-link" href="/login">
            Voltar a entrar
          </a>
        </div>
      </form>
    </AuthShell>
  );
}
