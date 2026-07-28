import { describe, expect, it } from 'vitest';
import {
  bookingBadgeTone,
  formatDurationLabel,
  paymentSummaryLabel,
} from '@/features/appointments/domain/appointment-detail';

describe('bookingBadgeTone', () => {
  it('maps confirmed, presence_confirmed and completed to success', () => {
    expect(bookingBadgeTone('confirmed')).toBe('success');
    expect(bookingBadgeTone('presence_confirmed')).toBe('success');
    expect(bookingBadgeTone('completed')).toBe('success');
  });

  it('maps cancelled to danger', () => {
    expect(bookingBadgeTone('cancelled')).toBe('danger');
  });

  it('maps no_show to warning, distinct from cancelled', () => {
    expect(bookingBadgeTone('no_show')).toBe('warning');
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

describe('paymentSummaryLabel', () => {
  it('reads no payment row as Pendente (nothing to collect before completion)', () => {
    expect(paymentSummaryLabel(null)).toBe('Pendente');
  });

  it('reads an explicit pending row as Pendente', () => {
    expect(paymentSummaryLabel({ status: 'pending', method: null })).toBe('Pendente');
  });

  it('reads a paid row with the payment method', () => {
    expect(paymentSummaryLabel({ status: 'paid', method: 'cash' })).toBe('Pago (Dinheiro)');
    expect(paymentSummaryLabel({ status: 'paid', method: 'mbway' })).toBe('Pago (MB WAY)');
  });

  it('reads a refunded row as Estornado', () => {
    expect(paymentSummaryLabel({ status: 'refunded', method: 'cash' })).toBe('Estornado');
  });
});
