import { describe, expect, it } from 'vitest';
import { parseClientPreferences, EMPTY_PREFERENCES } from '@/features/clients/domain/preferences';

describe('parseClientPreferences', () => {
  it('parses a well-formed preferences object', () => {
    const raw = { colors: 'Vermelho', formats: 'Amêndoa', techniques: 'Gel', products: 'OPI' };
    expect(parseClientPreferences(raw)).toEqual(raw);
  });

  it('defaults missing fields to empty strings', () => {
    expect(parseClientPreferences({ colors: 'Rosa' })).toEqual({
      ...EMPTY_PREFERENCES,
      colors: 'Rosa',
    });
  });

  it('falls back to empty preferences for the default {} jsonb value', () => {
    expect(parseClientPreferences({})).toEqual(EMPTY_PREFERENCES);
  });

  it('falls back to empty preferences for malformed/legacy data instead of throwing', () => {
    expect(parseClientPreferences({ colors: 123, unexpected: 'field' })).toEqual(EMPTY_PREFERENCES);
    expect(parseClientPreferences(null)).toEqual(EMPTY_PREFERENCES);
    expect(parseClientPreferences('not an object')).toEqual(EMPTY_PREFERENCES);
  });
});
