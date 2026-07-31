import { describe, expect, it } from 'vitest';
import {
  generateInviteToken,
  hashInviteToken,
  INVITE_TOKEN_PATTERN,
} from '@/lib/tenant-invite-token';

describe('tenant invite tokens (NEX-212)', () => {
  it('generates a 256-bit token matching the expected pattern', () => {
    const token = generateInviteToken();
    expect(token).toMatch(INVITE_TOKEN_PATTERN);
    expect(token).toHaveLength(64);
  });

  it('generates a different token on every call', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateInviteToken()));
    expect(tokens.size).toBe(50);
  });

  it('hashes deterministically (same input, same hash)', () => {
    const token = generateInviteToken();
    expect(hashInviteToken(token)).toBe(hashInviteToken(token));
  });

  it('produces a hash that never equals the plain token', () => {
    const token = generateInviteToken();
    expect(hashInviteToken(token)).not.toBe(token);
  });

  it('rejects malformed tokens against the pattern (defense in depth before any DB call)', () => {
    expect(INVITE_TOKEN_PATTERN.test('too-short')).toBe(false);
    expect(INVITE_TOKEN_PATTERN.test('G'.repeat(64))).toBe(false); // not hex
    expect(INVITE_TOKEN_PATTERN.test('a'.repeat(63))).toBe(false); // one char short
  });
});
