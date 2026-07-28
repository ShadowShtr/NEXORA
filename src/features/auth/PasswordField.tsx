'use client';

import { useId, useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

// Shared by /login and /definir-password — same input chrome as EmailField's icon +
// wrapper, plus the show/hide toggle neither the old plain <input type="password">
// nor any other page in this app had.
export function PasswordField({
  name,
  label,
  autoComplete,
  ariaInvalid,
  minLength,
  onChange,
  value,
}: {
  name: string;
  label: string;
  autoComplete: 'current-password' | 'new-password';
  ariaInvalid?: boolean;
  minLength?: number;
  onChange?: (value: string) => void;
  value?: string;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div className="form-field">
      <label className="login-label" htmlFor={id}>
        {label}
      </label>
      <div className="login-input-wrapper">
        <Lock className="login-input-icon" aria-hidden="true" size={19} />
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          className="login-input password-input"
          autoComplete={autoComplete}
          minLength={minLength}
          required
          aria-invalid={ariaInvalid || undefined}
          value={value}
          onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        />
        <button
          type="button"
          className="password-visibility-button"
          title={visible ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
          onClick={() => setVisible((current) => !current)}
        >
          {/* Not aria-label: Playwright's getByLabel() also matches elements named via
              aria-label (not just <label>-for/content), so an aria-label containing
              "palavra-passe" here would make every existing
              getByLabel('Palavra-passe').fill(...) across the e2e suite (225
              call sites) ambiguous against this button. Accessible name from content
              (a visually-hidden span) isn't picked up by getByLabel the same way,
              confirmed empirically — the input stays the sole match. */}
          <span className="sr-only">
            {visible ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
          </span>
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
