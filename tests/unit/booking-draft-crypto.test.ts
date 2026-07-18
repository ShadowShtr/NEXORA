import { beforeAll, describe, expect, it } from 'vitest';
import {
  decryptDraftPayload,
  encryptDraftPayload,
  generateResumeToken,
  hashResumeToken,
} from '@/lib/booking-draft-crypto';

// BOOKING_DRAFT_ENCRYPTION_KEY is read lazily inside each call, not at import time, so
// setting it in beforeAll (before any `it` runs) is enough — no import-order tricks needed.
beforeAll(() => {
  process.env.BOOKING_DRAFT_ENCRYPTION_KEY =
    '3807522ebbeae2fde5685e598c6c65566654b3652ee9ac0953e4e43985442186';
});

describe('generateResumeToken', () => {
  it('generates a 64-character hex string', () => {
    const token = generateResumeToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates a different token every time', () => {
    expect(generateResumeToken()).not.toBe(generateResumeToken());
  });
});

describe('hashResumeToken', () => {
  it('is deterministic for the same token', () => {
    const token = generateResumeToken();
    expect(hashResumeToken(token)).toBe(hashResumeToken(token));
  });

  it('produces a 64-character hex SHA-256 digest', () => {
    expect(hashResumeToken('anything')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is different for different tokens', () => {
    expect(hashResumeToken('token-a')).not.toBe(hashResumeToken('token-b'));
  });
});

describe('encryptDraftPayload / decryptDraftPayload', () => {
  it('round-trips a payload unchanged', () => {
    const payload = { registration: { name: 'Ana', phone: '+351911111111' }, selectedIds: ['a'] };
    const encrypted = encryptDraftPayload(payload);
    expect(decryptDraftPayload(encrypted)).toEqual(payload);
  });

  it('never stores the plaintext name in the encrypted output', () => {
    const encrypted = encryptDraftPayload({ registration: { name: 'SuperSecretName' } });
    expect(encrypted).not.toContain('SuperSecretName');
  });

  it('produces different ciphertext for the same payload each time (random IV)', () => {
    const payload = { a: 1 };
    expect(encryptDraftPayload(payload)).not.toBe(encryptDraftPayload(payload));
  });

  it('fails to decrypt with a tampered ciphertext (auth tag mismatch)', () => {
    const encrypted = encryptDraftPayload({ a: 1 });
    const tampered = `${encrypted.slice(0, -4)}abcd`;
    expect(() => decryptDraftPayload(tampered)).toThrow();
  });
});
