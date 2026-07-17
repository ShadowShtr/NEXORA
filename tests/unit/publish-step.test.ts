import { describe, expect, it } from 'vitest';
import {
  normalizeSlug,
  publicBookingUrl,
  publishStepSchema,
} from '@/features/onboarding/domain/publish-step';

describe('normalizeSlug', () => {
  it('lowercases, strips accents and collapses separators into hyphens', () => {
    expect(normalizeSlug('Joana Únhas & Sobrancelhas')).toBe('joana-unhas-sobrancelhas');
  });

  it('trims leading and trailing hyphens produced by punctuation', () => {
    expect(normalizeSlug('  --Ínês Nails!!--  ')).toBe('ines-nails');
  });

  it('is idempotent on an already-normalized slug', () => {
    expect(normalizeSlug('joana-unhas')).toBe('joana-unhas');
  });
});

describe('publishStepSchema', () => {
  it('accepts a normalized slug', () => {
    expect(publishStepSchema.safeParse({ slug: 'joana-unhas' }).success).toBe(true);
  });

  it('rejects a slug shorter than the minimum length', () => {
    expect(publishStepSchema.safeParse({ slug: 'ab' }).success).toBe(false);
  });

  it('rejects a slug with characters outside [a-z0-9-]', () => {
    expect(publishStepSchema.safeParse({ slug: 'joana_unhas' }).success).toBe(false);
    expect(publishStepSchema.safeParse({ slug: 'Joana-Unhas' }).success).toBe(false);
  });

  it('rejects an empty slug', () => {
    expect(publishStepSchema.safeParse({ slug: '' }).success).toBe(false);
  });
});

describe('publicBookingUrl', () => {
  it('builds the /b/{slug} public link', () => {
    expect(publicBookingUrl('https://nexora.app', 'joana-unhas')).toBe(
      'https://nexora.app/b/joana-unhas',
    );
  });
});
