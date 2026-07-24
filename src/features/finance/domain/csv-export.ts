import { formatInTimeZone } from 'date-fns-tz';

// NEX-132: "Exportar CSV — UTF-8, colunas documentadas, proteção CSV injection."
//
// Colunas (nesta ordem): Data (completed_at na timezone do tenant, dd/MM/yyyy) · Cliente
// · Serviços (descrições dos itens service/package, separadas por "; ") · Método
// (Dinheiro/MB WAY/Pendente/Estornado) · Valor (EUR, o valor do pagamento) · Extras (EUR,
// soma dos itens manual_extra) · Desconto (EUR, soma dos itens discount, sempre positivo).
export type FinanceTransactionRow = Readonly<{
  completedAtIso: string;
  clientName: string;
  serviceDescriptions: readonly string[];
  paymentMethod: 'cash' | 'mbway' | null;
  paymentStatus: 'pending' | 'paid' | 'refunded';
  amountCents: number;
  extrasCents: number;
  discountCents: number;
}>;

const HEADER = [
  'Data',
  'Cliente',
  'Serviços',
  'Método',
  'Valor (EUR)',
  'Extras (EUR)',
  'Desconto (EUR)',
];

const METHOD_LABELS: Record<'cash' | 'mbway', string> = { cash: 'Dinheiro', mbway: 'MB WAY' };

function paymentMethodLabel(row: FinanceTransactionRow): string {
  if (row.paymentStatus === 'pending') return 'Pendente';
  if (row.paymentStatus === 'refunded') return 'Estornado';
  return row.paymentMethod ? METHOD_LABELS[row.paymentMethod] : '';
}

function formatEurosPlain(cents: number): string {
  return (cents / 100).toFixed(2);
}

// OWASP CSV injection: a field starting with =, +, -, @, tab or CR is interpreted as a
// formula by Excel/Sheets/LibreOffice when the file is opened (e.g. a client name of
// "=cmd|'/c calc'!A1" or a description starting with "-"). A leading apostrophe forces
// text interpretation without changing the visible value — Excel and LibreOffice both
// hide a leading "'" in a cell's display, so this is invisible in normal use. Applied
// before RFC4180 quoting/escaping, since the guard character itself never needs quoting.
function sanitizeCsvField(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/["\n\r,]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }
  return guarded;
}

// U+FEFF (UTF-8 BOM) + CRLF line endings so Excel (Windows in particular) opens this
// correctly — without the BOM, Excel guesses the system codepage instead of UTF-8 and
// mangles accented characters in client names and the "Método"/"EUR" headers.
const UTF8_BOM = String.fromCharCode(0xfeff);

export function buildFinanceTransactionsCsv(
  rows: readonly FinanceTransactionRow[],
  timezone: string,
): string {
  const lines: string[][] = [HEADER];
  for (const row of rows) {
    lines.push([
      formatInTimeZone(row.completedAtIso, timezone, 'dd/MM/yyyy'),
      row.clientName,
      row.serviceDescriptions.join('; '),
      paymentMethodLabel(row),
      formatEurosPlain(row.amountCents),
      formatEurosPlain(row.extrasCents),
      formatEurosPlain(row.discountCents),
    ]);
  }
  const body = lines.map((line) => line.map(sanitizeCsvField).join(',')).join('\r\n');
  return `${UTF8_BOM}${body}\r\n`;
}
