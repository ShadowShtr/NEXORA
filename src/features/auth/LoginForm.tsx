'use client';

import { Suspense, useActionState, useId } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Mail } from 'lucide-react';
import { login } from './actions';
import { PasswordField } from './PasswordField';
import type { Result } from '@/lib/result';

function NoProfileNotice() {
  const searchParams = useSearchParams();
  if (searchParams.get('error') !== 'no_profile') return null;
  return (
    <p role="alert" className="form-error login-form-alert">
      <AlertCircle size={16} aria-hidden="true" />
      <span>Esta conta ainda não está configurada. Contacte o suporte.</span>
    </p>
  );
}

// NEX-020's login() server action (rate limiting, neutral "E-mail ou palavra-passe
// incorretos." for every failure cause — wrong password, unknown e-mail, or rate
// limited alike, NEX-166) is reused as-is; only the presentation is new here. The
// generic message is intentional and stays that way — a distinct "too many
// attempts" wording would itself leak whether a guess was merely wrong or rate
// limited, which is exactly what NEX-166 set out to avoid.
export function LoginForm() {
  const [state, formAction, pending] = useActionState<Result<null> | null, FormData>(login, null);
  const emailId = useId();
  const invalid = state !== null && !state.ok;

  return (
    <>
      <h1 className="login-title">Bem-vinda de volta</h1>
      <p className="login-subtitle">Entre para acompanhar o seu negócio.</p>

      <form className="login-form" aria-label="Iniciar sessão" action={formAction}>
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
              aria-invalid={invalid || undefined}
              aria-describedby={invalid ? 'login-form-error' : undefined}
            />
          </div>
        </div>

        <PasswordField
          name="password"
          label="Palavra-passe"
          autoComplete="current-password"
          ariaInvalid={invalid}
        />

        <div className="login-forgot-row">
          <a className="login-forgot-link" href="/recuperar-password">
            Esqueceu-se da palavra-passe?
          </a>
        </div>

        <Suspense fallback={null}>
          <NoProfileNotice />
        </Suspense>

        {invalid ? (
          <p id="login-form-error" role="alert" className="form-error login-form-alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{state.error.message}</span>
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
              <span className="login-submit-spinner" aria-hidden="true" />A entrar…
            </>
          ) : (
            'Entrar'
          )}
        </button>
      </form>

      <footer className="login-footer">
        <p className="login-account-note">A sua conta é criada pelo administrador da NEXORA.</p>
        <p className="login-version">NEXORA 0.1.0</p>
      </footer>
    </>
  );
}
