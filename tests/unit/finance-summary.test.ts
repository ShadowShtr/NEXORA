import { describe, expect, it } from 'vitest';
import {
  buildFinanceSummary,
  buildPendingPaymentMessage,
  computeTrend,
  type CompletedAppointmentRow,
} from '@/features/finance/domain/summary';

function row(overrides: Partial<CompletedAppointmentRow> = {}): CompletedAppointmentRow {
  return {
    payment: { method: 'cash', status: 'paid', amountCents: 3000 },
    items: [],
    ...overrides,
  };
}

describe('buildFinanceSummary', () => {
  it('splits totals by cash, mbway and pending', () => {
    const rows = [
      row({ payment: { method: 'cash', status: 'paid', amountCents: 6500 } }),
      row({ payment: { method: 'mbway', status: 'paid', amountCents: 4200 } }),
      row({ payment: { method: null, status: 'pending', amountCents: 1800 } }),
    ];

    const summary = buildFinanceSummary(rows);
    expect(summary.cashCents).toBe(6500);
    expect(summary.mbwayCents).toBe(4200);
    expect(summary.pendingCents).toBe(1800);
    expect(summary.totalCents).toBe(12500);
    expect(summary.receivedCents).toBe(10700);
  });

  it('computes percentages that reflect each bucket share of the total', () => {
    const rows = [
      row({ payment: { method: 'cash', status: 'paid', amountCents: 650 } }),
      row({ payment: { method: 'mbway', status: 'paid', amountCents: 420 } }),
      row({ payment: { method: null, status: 'pending', amountCents: 180 } }),
    ];

    const summary = buildFinanceSummary(rows);
    expect(summary.cashPercent).toBe(52);
    expect(summary.mbwayPercent).toBe(34);
    expect(summary.pendingPercent).toBe(14);
  });

  it('returns all zeros without dividing by zero when there are no rows', () => {
    const summary = buildFinanceSummary([]);
    expect(summary.totalCents).toBe(0);
    expect(summary.appointmentsCount).toBe(0);
    expect(summary.averageTicketCents).toBe(0);
    expect(summary.cashPercent).toBe(0);
  });

  it('computes ticket médio as total faturado divided by number of atendimentos', () => {
    const rows = [
      row({ payment: { method: 'cash', status: 'paid', amountCents: 3000 } }),
      row({ payment: { method: 'cash', status: 'paid', amountCents: 5000 } }),
    ];
    const summary = buildFinanceSummary(rows);
    expect(summary.appointmentsCount).toBe(2);
    expect(summary.averageTicketCents).toBe(4000);
  });

  it('sums manual_extra items into extrasCents and discount items (stored negative) into discountsCents', () => {
    const rows = [
      row({
        items: [
          { sourceType: 'service', unitPriceCents: 2500, quantity: 1 },
          { sourceType: 'manual_extra', unitPriceCents: 500, quantity: 2 },
          { sourceType: 'discount', unitPriceCents: -300, quantity: 1 },
        ],
      }),
    ];
    const summary = buildFinanceSummary(rows);
    expect(summary.extrasCents).toBe(1000);
    expect(summary.discountsCents).toBe(300);
  });

  it('excludes refunded payments from every bucket, including the total', () => {
    const rows = [
      row({ payment: { method: 'cash', status: 'refunded', amountCents: 9999 } }),
      row({ payment: { method: 'cash', status: 'paid', amountCents: 1000 } }),
    ];
    const summary = buildFinanceSummary(rows);
    expect(summary.totalCents).toBe(1000);
    expect(summary.cashCents).toBe(1000);
  });

  it('treats an appointment with no payment row yet as contributing nothing', () => {
    const summary = buildFinanceSummary([row({ payment: null })]);
    expect(summary.totalCents).toBe(0);
    expect(summary.appointmentsCount).toBe(1);
  });
});

describe('computeTrend', () => {
  it('reports a positive trend when the current period is higher', () => {
    expect(computeTrend(1150, 1000)).toEqual({ direction: 'positive', percent: 15 });
  });

  it('reports a negative trend when the current period is lower', () => {
    expect(computeTrend(800, 1000)).toEqual({ direction: 'negative', percent: 20 });
  });

  it('reports neutral with 0% when both periods are equal and non-zero', () => {
    expect(computeTrend(1000, 1000)).toEqual({ direction: 'neutral', percent: 0 });
  });

  it('reports neutral with a null percent when both periods are zero', () => {
    expect(computeTrend(0, 0)).toEqual({ direction: 'neutral', percent: null });
  });

  it('reports positive with a null percent when the previous period was zero but the current is not', () => {
    expect(computeTrend(500, 0)).toEqual({ direction: 'positive', percent: null });
  });
});

describe('buildPendingPaymentMessage', () => {
  it('includes the client name and the pre-formatted amount', () => {
    const message = buildPendingPaymentMessage('Ana Ferreira', '45,00 €');
    expect(message).toContain('Ana Ferreira');
    expect(message).toContain('45,00 €');
  });
});
