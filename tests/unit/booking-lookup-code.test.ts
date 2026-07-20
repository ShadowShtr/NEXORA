import { describe, expect, it } from 'vitest';
import { BOOKING_LOOKUP_CODE_PATTERN } from '@/lib/booking-lookup-code-pattern';

describe('BOOKING_LOOKUP_CODE_PATTERN', () => {
  it('accepts an 8-character code from the safe alphabet', () => {
    expect(BOOKING_LOOKUP_CODE_PATTERN.test('7K4PXM2Q')).toBe(true);
  });

  it('accepts lowercase (case-insensitive input)', () => {
    expect(BOOKING_LOOKUP_CODE_PATTERN.test('7k4pxm2q')).toBe(true);
  });

  it('rejects ambiguous characters excluded from the alphabet (0, O, 1, I, L)', () => {
    expect(BOOKING_LOOKUP_CODE_PATTERN.test('0K4PXM2Q')).toBe(false);
    expect(BOOKING_LOOKUP_CODE_PATTERN.test('OK4PXM2Q')).toBe(false);
    expect(BOOKING_LOOKUP_CODE_PATTERN.test('1K4PXM2Q')).toBe(false);
    expect(BOOKING_LOOKUP_CODE_PATTERN.test('IK4PXM2Q')).toBe(false);
    expect(BOOKING_LOOKUP_CODE_PATTERN.test('LK4PXM2Q')).toBe(false);
  });

  it('rejects a code shorter than 8 characters', () => {
    expect(BOOKING_LOOKUP_CODE_PATTERN.test('7K4PXM2')).toBe(false);
  });

  it('rejects a code longer than 8 characters', () => {
    expect(BOOKING_LOOKUP_CODE_PATTERN.test('7K4PXM2QQ')).toBe(false);
  });

  it('rejects a code with punctuation or whitespace', () => {
    expect(BOOKING_LOOKUP_CODE_PATTERN.test('7K4P XM2')).toBe(false);
    expect(BOOKING_LOOKUP_CODE_PATTERN.test('7K4P-XM2')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(BOOKING_LOOKUP_CODE_PATTERN.test('')).toBe(false);
  });
});
