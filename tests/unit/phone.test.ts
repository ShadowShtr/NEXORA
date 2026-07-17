import { describe, expect, it } from 'vitest';
import { normalizePhoneE164 } from '@/lib/phone';

describe('normalizePhoneE164', () => {
  it('prepends the default country code to a local number', () => {
    expect(normalizePhoneE164('910000000')).toBe('+351910000000');
  });

  it('strips spaces, dots and dashes', () => {
    expect(normalizePhoneE164('910 000-000')).toBe('+351910000000');
    expect(normalizePhoneE164('910.000.000')).toBe('+351910000000');
  });

  it('passes through an already-E.164 number unchanged', () => {
    expect(normalizePhoneE164('+351910000000')).toBe('+351910000000');
    expect(normalizePhoneE164('+44 7911 123456')).toBe('+447911123456');
  });

  it('converts a 00-prefixed international number', () => {
    expect(normalizePhoneE164('00351910000000')).toBe('+351910000000');
  });

  it('strips a leading trunk zero before prepending the country code', () => {
    expect(normalizePhoneE164('0910000000')).toBe('+351910000000');
  });

  it('returns null for empty or too-short input', () => {
    expect(normalizePhoneE164('')).toBeNull();
    expect(normalizePhoneE164('12')).toBeNull();
  });
});
