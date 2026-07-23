import { describe, expect, it } from 'vitest';
import { hasAffectedRows } from '@/lib/write-confirmation';

describe('hasAffectedRows', () => {
  it('returns false for null or undefined (no data returned)', () => {
    expect(hasAffectedRows(null)).toBe(false);
    expect(hasAffectedRows(undefined)).toBe(false);
  });

  it('returns false for an empty array (mutation matched zero rows)', () => {
    expect(hasAffectedRows([])).toBe(false);
  });

  it('returns true when at least one row was returned', () => {
    expect(hasAffectedRows([{ id: '1' }])).toBe(true);
    expect(hasAffectedRows([{ id: '1' }, { id: '2' }])).toBe(true);
  });
});
