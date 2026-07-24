import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildFinanceWorkbook, sumFinanceTotals } from '@/features/finance/domain/xlsx-export';
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
    extrasCents: 200,
    discountCents: 100,
    ...overrides,
  };
}

// Round-trips the workbook through a real xlsx buffer (write, then reload) rather than
// inspecting the builder's in-memory model directly — proves the file that actually
// reaches the owner's disk has the values under test, not just what was asked of the
// builder API.
async function loadWorksheet(rows: readonly FinanceTransactionRow[]) {
  const buffer = await buildFinanceWorkbook(rows, TZ).xlsx.writeBuffer();
  const reloaded = new ExcelJS.Workbook();
  await reloaded.xlsx.load(buffer);
  return reloaded.getWorksheet('Financeiro')!;
}

describe('sumFinanceTotals', () => {
  it('sums valor/extras/desconto across every row', () => {
    const totals = sumFinanceTotals([
      row({ amountCents: 1000, extrasCents: 100, discountCents: 50 }),
      row({ amountCents: 2000, extrasCents: 0, discountCents: 200 }),
    ]);
    expect(totals).toEqual({ valorCents: 3000, extrasCents: 100, descontoCents: 250 });
  });

  it('is all-zero for no rows', () => {
    expect(sumFinanceTotals([])).toEqual({ valorCents: 0, extrasCents: 0, descontoCents: 0 });
  });
});

describe('buildFinanceWorkbook', () => {
  it('writes a bold header row with the documented columns', async () => {
    const sheet = await loadWorksheet([row()]);
    const header = sheet.getRow(1).values as unknown[];
    expect(header.slice(1)).toEqual([
      'Data',
      'Cliente',
      'Serviços',
      'Método',
      'Valor (EUR)',
      'Extras (EUR)',
      'Desconto (EUR)',
    ]);
    expect(sheet.getRow(1).font?.bold).toBe(true);
  });

  it('writes one row per transaction with the right values', async () => {
    const sheet = await loadWorksheet([row()]);
    const dataRow = sheet.getRow(2).values as unknown[];
    expect(dataRow.slice(1)).toEqual([
      '01/06/2026',
      'Ana Silva',
      'Verniz Gel',
      'Dinheiro',
      15,
      2,
      1,
    ]);
  });

  it('reconciliation: the bold totals row equals an independent sum of every data row actually written to the file', async () => {
    const rows = [
      row({ amountCents: 1500, extrasCents: 200, discountCents: 100 }),
      row({ amountCents: 3000, extrasCents: 0, discountCents: 500 }),
      row({ amountCents: 2250, extrasCents: 150, discountCents: 0 }),
    ];
    const sheet = await loadWorksheet(rows);

    let summedValor = 0;
    let summedExtras = 0;
    let summedDesconto = 0;
    for (let rowNumber = 2; rowNumber <= rows.length + 1; rowNumber += 1) {
      const values = sheet.getRow(rowNumber).values as unknown[];
      summedValor += values[5] as number;
      summedExtras += values[6] as number;
      summedDesconto += values[7] as number;
    }

    const totalsRow = sheet.getRow(rows.length + 2);
    expect(totalsRow.getCell(4).value).toBe('Total');
    expect(totalsRow.font?.bold).toBe(true);
    expect(totalsRow.getCell(5).value).toBeCloseTo(summedValor, 10);
    expect(totalsRow.getCell(6).value).toBeCloseTo(summedExtras, 10);
    expect(totalsRow.getCell(7).value).toBeCloseTo(summedDesconto, 10);

    // And the totals row matches the expected 67.50/3.50/6.00 EUR exactly.
    expect(totalsRow.getCell(5).value).toBeCloseTo(67.5, 10);
    expect(totalsRow.getCell(6).value).toBeCloseTo(3.5, 10);
    expect(totalsRow.getCell(7).value).toBeCloseTo(6, 10);
  });

  it('guards a client name that could be read as a formula', async () => {
    const sheet = await loadWorksheet([row({ clientName: '=cmd|"/c calc"!A1' })]);
    const dataRow = sheet.getRow(2).values as unknown[];
    expect((dataRow[2] as string).startsWith("'")).toBe(true);
  });
});
