'use client';

import { useActionState, useId, useState, type FormEvent } from 'react';
import { Check, Circle, Lock } from 'lucide-react';
import { PasswordField } from './PasswordField';
import { updatePassword } from './actions';
import { checkPasswordRequirements } from './domain/password-requirements';
import type { Result } from '@/lib/result';

export function DefinirPasswordForm() {
  const [state, formAction, pending] = useActionState<Result<null> | null, FormData>(
    updatePassword,
    null,
  );
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const confirmId = useId();

  const requirements = checkPasswordRequirements(password);
  const allRequirementsMet = requirements.every((requirement) => requirement.met);
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const canSubmit = allRequirementsMet && confirmPassword.length > 0 && !mismatch;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!canSubmit) event.preventDefault();
  }

  return (
    <>
      <h1 className="login-title">Definir nova palavra-passe</h1>
      <p className="login-subtitle">Escolha uma palavra-passe para a sua conta NEXORA.</p>

      <form
        className="login-form"
        aria-label="Definir nova palavra-passe"
        action={formAction}
        onSubmit={handleSubmit}
      >
        <PasswordField
          name="password"
          label="Nova palavra-passe"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
        />

        <ul className="password-requirements">
          {requirements.map((requirement) => (
            <li key={requirement.key} data-met={requirement.met || undefined}>
              {requirement.met ? (
                <Check size={14} aria-hidden="true" />
              ) : (
                <Circle size={14} aria-hidden="true" />
              )}
              {requirement.label}
            </li>
          ))}
        </ul>

        <div className="form-field">
          <label className="login-label" htmlFor={confirmId}>
            Confirmar palavra-passe
          </label>
          <div className="login-input-wrapper">
            <Lock className="login-input-icon" aria-hidden="true" size={19} />
            <input
              id={confirmId}
              type="password"
              className="login-input"
              autoComplete="new-password"
              required
              aria-invalid={mismatch || undefined}
              aria-describedby={mismatch ? 'confirm-password-error' : undefined}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>
          {mismatch ? (
            <p id="confirm-password-error" className="login-field-error">
              As palavras-passe não coincidem.
            </p>
          ) : null}
        </div>

        {state && !state.ok ? (
          <p role="alert" className="form-error login-form-alert">
            {state.error.message}
          </p>
        ) : null}

        <button
          type="submit"
          className="login-submit-button"
          disabled={pending || !canSubmit}
          data-loading={pending || undefined}
        >
          {pending ? (
            <>
              <span className="login-submit-spinner" aria-hidden="true" />A guardar…
            </>
          ) : (
            'Guardar palavra-passe'
          )}
        </button>
      </form>
    </>
  );
}
