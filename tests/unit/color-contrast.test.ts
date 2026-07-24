import { describe, expect, it } from 'vitest';
import { contrastRatio, WCAG_AA_LARGE_TEXT, WCAG_AA_NORMAL_TEXT } from '@/lib/color-contrast';

describe('contrastRatio', () => {
  it('matches the well-known WCAG reference ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(contrastRatio('#000000', '#000000')).toBeCloseTo(1, 5);
  });

  it('is symmetric regardless of argument order', () => {
    expect(contrastRatio('#362b31', '#fff8fb')).toBeCloseTo(
      contrastRatio('#fff8fb', '#362b31'),
      10,
    );
  });

  it('exposes the AA thresholds used to gate the design tokens', () => {
    expect(WCAG_AA_NORMAL_TEXT).toBe(4.5);
    expect(WCAG_AA_LARGE_TEXT).toBe(3);
  });
});
