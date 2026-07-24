import ExcelJS from 'exceljs';
import { formatInTimeZone } from 'date-fns-tz';
import type { FinanceTransactionRow } from '../transactions-lookup';
import { guardFormulaInjection } from './formula-injection-guard';

// NEX-133: "Exportar Excel — workbook legível e totais." Same columns/rows as the CSV
// export (NEX-132), one worksheet, bold header + bold totals row at the bottom summing
// Valor/Extras/Desconto — "Testes obrigatórios: Reconciliação" checks those totals
// against an independent sum of the same rows. Currency columns get a real numeric
// format (not text, unlike CSV) so the workbook opens with right-aligned, formatted
// numbers a formula could sum directly.
const METHOD_LABELS: Record<'cash' | 'mbway', string> = { cash: 'Dinheiro', mbway: 'MB WAY' };

function paymentMethodLabel(row: FinanceTransactionRow): string {
  if (row.paymentStatus === 'pending') return 'Pendente';
  if (row.paymentStatus === 'refunded') return 'Estornado';
  return row.paymentMethod ? METHOD_LABELS[row.paymentMethod] : '';
}

export type FinanceWorkbookTotals = Readonly<{
  valorCents: number;
  extrasCents: number;
  descontoCents: number;
}>;

export function sumFinanceTotals(rows: readonly FinanceTransactionRow[]): FinanceWorkbookTotals {
  return rows.reduce(
    (totals, row) => ({
      valorCents: totals.valorCents + row.amountCents,
      extrasCents: totals.extrasCents + row.extrasCents,
      descontoCents: totals.descontoCents + row.discountCents,
    }),
    { valorCents: 0, extrasCents: 0, descontoCents: 0 },
  );
}

export function buildFinanceWorkbook(
  rows: readonly FinanceTransactionRow[],
  timezone: string,
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Financeiro');

  sheet.columns = [
    { header: 'Data', key: 'data', width: 12 },
    { header: 'Cliente', key: 'cliente', width: 26 },
    { header: 'Serviços', key: 'servicos', width: 32 },
    { header: 'Método', key: 'metodo', width: 12 },
    { header: 'Valor (EUR)', key: 'valor', width: 14 },
    { header: 'Extras (EUR)', key: 'extras', width: 14 },
    { header: 'Desconto (EUR)', key: 'desconto', width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow({
      data: formatInTimeZone(row.completedAtIso, timezone, 'dd/MM/yyyy'),
      cliente: guardFormulaInjection(row.clientName),
      servicos: guardFormulaInjection(row.serviceDescriptions.join('; ')),
      metodo: paymentMethodLabel(row),
      valor: row.amountCents / 100,
      extras: row.extrasCents / 100,
      desconto: row.discountCents / 100,
    });
  }

  const totals = sumFinanceTotals(rows);
  const totalsRow = sheet.addRow({
    data: '',
    cliente: '',
    servicos: '',
    metodo: 'Total',
    valor: totals.valorCents / 100,
    extras: totals.extrasCents / 100,
    desconto: totals.descontoCents / 100,
  });
  totalsRow.font = { bold: true };

  for (const key of ['valor', 'extras', 'desconto']) {
    sheet.getColumn(key).numFmt = '#,##0.00';
  }

  return workbook;
}
