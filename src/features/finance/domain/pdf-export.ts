import PDFDocument from 'pdfkit';
import { formatInTimeZone } from 'date-fns-tz';
import type { FinanceTransactionRow } from '../transactions-lookup';
import { computeFinancePdfLayout } from './pdf-layout';
import { sumFinanceTotals } from './xlsx-export';

// NEX-134: "Exportar PDF — layout sem sobreposição e totals." Portrait A4, 5 columns
// (Data/Cliente/Serviços/Método/Valor) — Extras/Desconto are summarized in the totals
// line instead of getting their own columns, to keep every column wide enough to stay
// readable without wrapping. Row placement comes entirely from computeFinancePdfLayout
// (pdf-layout.ts, unit-tested for "no overlap" — this project has no visual-regression
// tooling to test the actual rendered PDF against); fixed row height is what makes that
// placement exact, so long text is truncated with an ellipsis (measured with pdfkit's
// own widthOfString, not a character-count guess) rather than wrapped — a wrapped cell
// would need a variable row height, breaking the layout's own non-overlap guarantee.
const PAGE_HEIGHT = 841.89; // A4 portrait, points
const MARGIN = 40;
const HEADER_HEIGHT = 70;
const ROW_HEIGHT = 18;
const FONT_SIZE = 9;

const COLUMNS = [
  { key: 'data', label: 'Data', width: 60 },
  { key: 'cliente', label: 'Cliente', width: 120 },
  { key: 'servicos', label: 'Serviços', width: 160 },
  { key: 'metodo', label: 'Método', width: 60 },
  { key: 'valor', label: 'Valor (EUR)', width: 75 },
] as const;

const METHOD_LABELS: Record<'cash' | 'mbway', string> = { cash: 'Dinheiro', mbway: 'MB WAY' };

function paymentMethodLabel(row: FinanceTransactionRow): string {
  if (row.paymentStatus === 'pending') return 'Pendente';
  if (row.paymentStatus === 'refunded') return 'Estornado';
  return row.paymentMethod ? METHOD_LABELS[row.paymentMethod] : '';
}

function formatEurosPlain(cents: number): string {
  return (cents / 100).toFixed(2);
}

function truncateToWidth(doc: PDFKit.PDFDocument, text: string, maxWidth: number): string {
  if (doc.widthOfString(text) <= maxWidth) return text;
  const ellipsis = '…';
  let truncated = text;
  while (truncated.length > 0 && doc.widthOfString(truncated + ellipsis) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}${ellipsis}`;
}

function drawTableHeader(
  doc: PDFKit.PDFDocument,
  title: string,
  subtitle: string,
  headerY: number,
) {
  doc.font('Helvetica-Bold').fontSize(14).text(title, MARGIN, MARGIN);
  doc
    .font('Helvetica')
    .fontSize(10)
    .text(subtitle, MARGIN, MARGIN + 18);

  doc.font('Helvetica-Bold').fontSize(FONT_SIZE);
  let x = MARGIN;
  for (const column of COLUMNS) {
    doc.text(column.label, x, headerY, { width: column.width, lineBreak: false });
    x += column.width;
  }
  doc.font('Helvetica');
}

function drawRow(
  doc: PDFKit.PDFDocument,
  y: number,
  values: readonly string[],
  options: { bold?: boolean } = {},
) {
  doc.font(options.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(FONT_SIZE);
  let x = MARGIN;
  for (let i = 0; i < COLUMNS.length; i += 1) {
    const column = COLUMNS[i]!;
    doc.text(truncateToWidth(doc, values[i] ?? '', column.width - 4), x, y, {
      width: column.width,
      lineBreak: false,
    });
    x += column.width;
  }
}

export function buildFinancePdf(
  rows: readonly FinanceTransactionRow[],
  timezone: string,
  title: string,
  subtitle: string,
): Promise<Buffer> {
  const layout = computeFinancePdfLayout(rows.length, {
    pageHeight: PAGE_HEIGHT,
    marginTop: MARGIN,
    marginBottom: MARGIN,
    headerHeight: HEADER_HEIGHT,
    rowHeight: ROW_HEIGHT,
  });

  const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  const headerY = MARGIN + HEADER_HEIGHT - 16;
  let currentPage = 0;
  drawTableHeader(doc, title, subtitle, headerY);

  rows.forEach((row, index) => {
    const placement = layout.rows[index]!;
    if (placement.page !== currentPage) {
      doc.addPage();
      currentPage = placement.page;
      drawTableHeader(doc, title, subtitle, headerY);
    }
    drawRow(doc, placement.y, [
      formatInTimeZone(row.completedAtIso, timezone, 'dd/MM/yyyy'),
      row.clientName,
      row.serviceDescriptions.join('; '),
      paymentMethodLabel(row),
      formatEurosPlain(row.amountCents),
    ]);
  });

  if (layout.totalsRow.page !== currentPage) {
    doc.addPage();
    currentPage = layout.totalsRow.page;
    drawTableHeader(doc, title, subtitle, headerY);
  }
  const totals = sumFinanceTotals(rows);
  drawRow(doc, layout.totalsRow.y, ['', '', '', 'Total', formatEurosPlain(totals.valorCents)], {
    bold: true,
  });
  doc
    .font('Helvetica')
    .fontSize(FONT_SIZE)
    .text(
      `Extras: ${formatEurosPlain(totals.extrasCents)} EUR · Desconto: ${formatEurosPlain(totals.descontoCents)} EUR`,
      MARGIN,
      layout.totalsRow.y + ROW_HEIGHT,
    );

  return new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.end();
  });
}
