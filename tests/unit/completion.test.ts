import { describe, expect, it } from 'vitest';
import {
  parseEurosToCents,
  resolvePaymentFromChoice,
} from '@/features/appointments/domain/completion';

describe('resolvePaymentFromChoice', () => {
  it('maps "cash" to paid/cash', () => {
    expect(resolvePaymentFromChoice('cash')).toEqual({ status: 'paid', method: 'cash' });
  });

  it('maps "mbway" to paid/mbway', () => {
    expect(resolvePaymentFromChoice('mbway')).toEqual({ status: 'paid', method: 'mbway' });
  });

  it('maps "pending" to pending/null', () => {
    expect(resolvePaymentFromChoice('pending')).toEqual({ status: 'pending', method: null });
  });
});

describe('parseEurosToCents', () => {
  it('parses a whole euro amount', () => {
    expect(parseEurosToCents('25')).toBe(2500);
  });

  it('parses an amount with cents', () => {
    expect(parseEurosToCents('25.50')).toBe(2550);
  });

  it('parses a comma decimal separator (pt-PT)', () => {
    expect(parseEurosToCents('25,5')).toBe(2550);
  });

  it('parses zero', () => {
    expect(parseEurosToCents('0')).toBe(0);
  });

  it('pads a single decimal digit', () => {
    expect(parseEurosToCents('10.5')).toBe(1050);
  });

  it('rejects a negative amount', () => {
    expect(parseEurosToCents('-5')).toBeNull();
  });

  it('rejects more than two decimal places', () => {
    expect(parseEurosToCents('10.999')).toBeNull();
  });

  it('rejects non-numeric input', () => {
    expect(parseEurosToCents('abc')).toBeNull();
  });

  it('rejects an empty string', () => {
    expect(parseEurosToCents('')).toBeNull();
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseEurosToCents(' 25.50 ')).toBe(2550);
  });
});
