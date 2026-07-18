import { describe, expect, it } from 'vitest';
import { clientContactSchema } from '@/lib/validation/client';

describe('clientContactSchema', () => {
  it('accepts a valid local phone number and normalizes it to E.164', () => {
    const result = clientContactSchema.safeParse({
      name: 'Ana Silva',
      phone: '912345678',
      email: '',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.phone).toBe('+351912345678');
  });

  it('accepts an already-E.164 phone number unchanged', () => {
    const result = clientContactSchema.safeParse({
      name: 'Ana Silva',
      phone: '+351912345678',
      email: '',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.phone).toBe('+351912345678');
  });

  it('accepts an omitted (optional) email', () => {
    const result = clientContactSchema.safeParse({ name: 'Ana Silva', phone: '912345678' });
    expect(result.success).toBe(true);
  });

  it('accepts a valid email when provided', () => {
    const result = clientContactSchema.safeParse({
      name: 'Ana Silva',
      phone: '912345678',
      email: 'ana@example.com',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email when provided', () => {
    const result = clientContactSchema.safeParse({
      name: 'Ana Silva',
      phone: '912345678',
      email: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a name shorter than 2 characters', () => {
    const result = clientContactSchema.safeParse({ name: 'A', phone: '912345678' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty name', () => {
    const result = clientContactSchema.safeParse({ name: '', phone: '912345678' });
    expect(result.success).toBe(false);
  });

  it('rejects an unrecognizable phone number', () => {
    const result = clientContactSchema.safeParse({ name: 'Ana Silva', phone: 'abc' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty phone number', () => {
    const result = clientContactSchema.safeParse({ name: 'Ana Silva', phone: '' });
    expect(result.success).toBe(false);
  });
});
