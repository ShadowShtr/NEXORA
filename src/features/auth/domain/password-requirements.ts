// Mirrors updatePasswordSchema (src/lib/validation/auth.ts) rule-for-rule so the
// checklist shown while typing never claims something is fine that the server would
// then reject — kept as a tiny, separately testable function rather than deriving it
// from the zod schema's error messages, which are meant for a failed *submission*
// result, not a live per-keystroke checklist.
export type PasswordRequirement = {
  key: 'length' | 'uppercase' | 'lowercase' | 'digit';
  label: string;
  met: boolean;
};

export function checkPasswordRequirements(password: string): PasswordRequirement[] {
  return [
    { key: 'length', label: 'Pelo menos 8 caracteres', met: password.length >= 8 },
    { key: 'uppercase', label: 'Uma letra maiúscula', met: /[A-Z]/.test(password) },
    { key: 'lowercase', label: 'Uma letra minúscula', met: /[a-z]/.test(password) },
    { key: 'digit', label: 'Um número', met: /[0-9]/.test(password) },
  ];
}
