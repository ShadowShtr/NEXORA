import { describe, expect, it } from 'vitest';
import { checkPasswordRequirements } from '@/features/auth/domain/password-requirements';
import { updatePasswordSchema } from '@/lib/validation/auth';

describe('checkPasswordRequirements', () => {
  it('reports every requirement unmet for an empty password', () => {
    expect(checkPasswordRequirements('')).toEqual([
      { key: 'length', label: 'Pelo menos 8 caracteres', met: false },
      { key: 'uppercase', label: 'Uma letra maiúscula', met: false },
      { key: 'lowercase', label: 'Uma letra minúscula', met: false },
      { key: 'digit', label: 'Um número', met: false },
    ]);
  });

  it('reports every requirement met for a password satisfying all rules', () => {
    const requirements = checkPasswordRequirements('NovaPass1');
    expect(requirements.every((requirement) => requirement.met)).toBe(true);
  });

  it('reports only length unmet for an all-lowercase-with-digit short password', () => {
    const requirements = checkPasswordRequirements('abc123');
    expect(requirements.find((r) => r.key === 'length')?.met).toBe(false);
    expect(requirements.find((r) => r.key === 'lowercase')?.met).toBe(true);
    expect(requirements.find((r) => r.key === 'digit')?.met).toBe(true);
    expect(requirements.find((r) => r.key === 'uppercase')?.met).toBe(false);
  });

  it('mirrors updatePasswordSchema: every requirement met implies the schema accepts it', () => {
    const password = 'NovaPass1';
    const requirements = checkPasswordRequirements(password);
    expect(requirements.every((requirement) => requirement.met)).toBe(true);
    expect(updatePasswordSchema.safeParse({ password }).success).toBe(true);
  });
});

describe('updatePasswordSchema', () => {
  it('rejects a password shorter than 8 characters', () => {
    const result = updatePasswordSchema.safeParse({ password: 'Ab1' });
    expect(result.success).toBe(false);
  });

  it('rejects a password with no uppercase letter', () => {
    const result = updatePasswordSchema.safeParse({ password: 'lowercase1' });
    expect(result.success).toBe(false);
  });

  it('rejects a password with no lowercase letter', () => {
    const result = updatePasswordSchema.safeParse({ password: 'UPPERCASE1' });
    expect(result.success).toBe(false);
  });

  it('rejects a password with no digit', () => {
    const result = updatePasswordSchema.safeParse({ password: 'NoDigitsHere' });
    expect(result.success).toBe(false);
  });

  it('accepts a password satisfying every rule', () => {
    const result = updatePasswordSchema.safeParse({ password: 'NovaPass1' });
    expect(result.success).toBe(true);
  });
});
