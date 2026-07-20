import { describe, expect, it } from 'vitest';
import {
  applyDiscount,
  computeDiscountCents,
  isValidDiscountValue,
  type Discount,
} from '@/features/appointments/domain/discount';

describe('computeDiscountCents', () => {
  it('applies a fixed discount below the base', () => {
    expect(computeDiscountCents({ type: 'fixed', value: 500, reason: '' }, 2500)).toBe(500);
  });

  it('applies a percent discount', () => {
    expect(computeDiscountCents({ type: 'percent', value: 10, reason: '' }, 2500)).toBe(250);
  });

  it('clamps a fixed discount larger than the base to the base itself (never negative total)', () => {
    expect(computeDiscountCents({ type: 'fixed', value: 999999, reason: '' }, 2500)).toBe(2500);
  });

  it('a 100% discount equals the full base', () => {
    expect(computeDiscountCents({ type: 'percent', value: 100, reason: '' }, 2500)).toBe(2500);
  });

  it('a 0-cents base always yields a 0 discount, fixed or percent', () => {
    expect(computeDiscountCents({ type: 'fixed', value: 500, reason: '' }, 0)).toBe(0);
    expect(computeDiscountCents({ type: 'percent', value: 50, reason: '' }, 0)).toBe(0);
  });

  it('rounds a fractional percent result to the nearest cent', () => {
    // 10% of 999 = 99.9 -> rounds to 100.
    expect(computeDiscountCents({ type: 'percent', value: 10, reason: '' }, 999)).toBe(100);
  });

  it('never returns a negative amount even for a negative input value', () => {
    expect(computeDiscountCents({ type: 'fixed', value: -500, reason: '' }, 2500)).toBe(0);
  });

  it('handles a very large base without overflow (safe integer range)', () => {
    const base = 1_000_000_000; // 10 million euros in cents
    expect(computeDiscountCents({ type: 'percent', value: 50, reason: '' }, base)).toBe(base / 2);
  });
});

describe('applyDiscount', () => {
  it('returns the base unchanged when there is no discount', () => {
    expect(applyDiscount(null, 2500)).toBe(2500);
  });

  it('subtracts the computed discount from the base', () => {
    const discount: Discount = { type: 'fixed', value: 500, reason: 'Cliente fiel' };
    expect(applyDiscount(discount, 2500)).toBe(2000);
  });

  it('never goes below 0 even with an oversized fixed discount', () => {
    const discount: Discount = { type: 'fixed', value: 999999, reason: '' };
    expect(applyDiscount(discount, 2500)).toBe(0);
  });
});

describe('isValidDiscountValue', () => {
  it('accepts a positive fixed value', () => {
    expect(isValidDiscountValue('fixed', 500)).toBe(true);
  });

  it('accepts a percent value up to 100', () => {
    expect(isValidDiscountValue('percent', 100)).toBe(true);
  });

  it('rejects a percent value above 100', () => {
    expect(isValidDiscountValue('percent', 100.01)).toBe(false);
  });

  it('rejects zero', () => {
    expect(isValidDiscountValue('fixed', 0)).toBe(false);
  });

  it('rejects a negative value', () => {
    expect(isValidDiscountValue('fixed', -1)).toBe(false);
  });

  it('rejects NaN and Infinity', () => {
    expect(isValidDiscountValue('fixed', NaN)).toBe(false);
    expect(isValidDiscountValue('fixed', Infinity)).toBe(false);
  });

  it('a large fixed value is still valid (the clamp happens in computeDiscountCents, not here)', () => {
    expect(isValidDiscountValue('fixed', 999999)).toBe(true);
  });
});
