import { describe, expect, it } from 'vitest';
import {
  formatDurationLabel,
  formatEuros,
} from '@/features/appointments/domain/appointment-wizard';

// toLocaleString('pt-PT', { style: 'currency' }) separates the amount and symbol with a
// non-breaking space (U+00A0), not a regular space — built via fromCharCode instead of
// a literal character in the source so this assertion can't silently rot into the wrong
// (regular) space through an editor/copy-paste normalizing whitespace.
const NBSP = String.fromCharCode(0xa0);

describe('formatEuros', () => {
  it('formats cents as pt-PT currency', () => {
    expect(formatEuros(9400)).toBe(`94,00${NBSP}€`);
  });
});

describe('formatDurationLabel', () => {
  it('formats minutes only under an hour', () => {
    expect(formatDurationLabel(45)).toBe('45 min');
  });

  it('formats whole hours with no remainder', () => {
    expect(formatDurationLabel(120)).toBe('2 h');
  });

  it('formats hours and minutes combined', () => {
    expect(formatDurationLabel(95)).toBe('1 h 35 min');
  });

  it('falls back to "0 min" for zero or negative totals', () => {
    expect(formatDurationLabel(0)).toBe('0 min');
    expect(formatDurationLabel(-10)).toBe('0 min');
  });
});
