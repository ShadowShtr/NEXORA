import { describe, expect, it } from 'vitest';
import {
  INSTAGRAM_HANDLE_PATTERN,
  normalizeInstagramHandle,
  publicProfileSchema,
} from '@/features/settings/domain/public-profile';

describe('normalizeInstagramHandle', () => {
  it('strips exactly one leading "@"', () => {
    expect(normalizeInstagramHandle('@ananails.studio')).toBe('ananails.studio');
  });

  it('leaves a handle without "@" untouched', () => {
    expect(normalizeInstagramHandle('ananails.studio')).toBe('ananails.studio');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeInstagramHandle('  @ananails  ')).toBe('ananails');
  });
});

describe('INSTAGRAM_HANDLE_PATTERN', () => {
  it('accepts letters, digits, dots and underscores', () => {
    expect(INSTAGRAM_HANDLE_PATTERN.test('ana_nails.studio99')).toBe(true);
  });

  it('rejects an "@" that survived normalization, spaces, or a full URL', () => {
    expect(INSTAGRAM_HANDLE_PATTERN.test('@ananails')).toBe(false);
    expect(INSTAGRAM_HANDLE_PATTERN.test('ana nails')).toBe(false);
    expect(INSTAGRAM_HANDLE_PATTERN.test('https://instagram.com/ananails')).toBe(false);
  });
});

describe('publicProfileSchema', () => {
  it('accepts a fully empty (all-cleared) profile', () => {
    const result = publicProfileSchema.safeParse({
      specialty: '',
      aboutDescription: '',
      instagramHandle: '',
      bookingEnabled: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a specialty longer than 80 characters', () => {
    const result = publicProfileSchema.safeParse({
      specialty: 'a'.repeat(81),
      aboutDescription: '',
      instagramHandle: '',
      bookingEnabled: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an about description longer than 600 characters', () => {
    const result = publicProfileSchema.safeParse({
      specialty: '',
      aboutDescription: 'a'.repeat(601),
      instagramHandle: '',
      bookingEnabled: true,
    });
    expect(result.success).toBe(false);
  });
});
