import { describe, expect, it } from 'vitest';
import { buildFinancePdf } from '@/features/finance/domain/pdf-export';
import type { FinanceTransactionRow } from '@/features/finance/transactions-lookup';

const TZ = 'Europe/Lisbon';

function row(overrides: Partial<FinanceTransactionRow> = {}): FinanceTransactionRow {
  return {
    completedAtIso: '2026-06-01T13:00:00.000Z',
    clientName: 'Ana Silva',
    serviceDescriptions: ['Verniz Gel'],
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    amountCents: 1500,
    extrasCents: 0,
    discountCents: 0,
    ...overrides,
  };
}

describe('buildFinancePdf', () => {
  it('produces a well-formed PDF buffer', async () => {
    const buffer = await buildFinancePdf([row()], TZ, 'Financeiro', 'Hoje');
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('handles zero rows without throwing', async () => {
    const buffer = await buildFinancePdf([], TZ, 'Financeiro', 'Hoje');
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('handles a very long client name without throwing (truncated, not wrapped)', async () => {
    const buffer = await buildFinancePdf(
      [row({ clientName: 'A'.repeat(500), serviceDescriptions: ['B'.repeat(500)] })],
      TZ,
      'Financeiro',
      'Hoje',
    );
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('spans multiple pages for a large number of rows without throwing', async () => {
    const rows = Array.from({ length: 120 }, (_, i) =>
      row({ clientName: `Cliente ${i}`, amountCents: 1000 + i }),
    );
    const buffer = await buildFinancePdf(rows, TZ, 'Financeiro', 'Ano');
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    // A single-page PDF for 120 rows at 18pt row height would be implausibly small —
    // a rough floor that would fail if pagination silently stopped emitting content.
    expect(buffer.length).toBeGreaterThan(2000);
  });
});
