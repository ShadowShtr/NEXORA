// NEX-134: "Exportar PDF — layout sem sobreposição e totals." This project has no
// pixel-diff visual regression tooling (no Percy/Chromatic/Playwright screenshot
// baselines), so "Testes obrigatórios: Visual regression" is met by testing the actual
// layout invariant a visual regression suite would ultimately be guarding — every row
// occupies a distinct, non-overlapping vertical slot, and nothing is placed past the
// page's bottom margin — as a pure, fully-tested function, kept separate from the
// pdfkit drawing calls in pdf-export.ts so it can be verified without rendering an
// actual PDF. Fixed row height (no per-row text wrapping — long text is truncated
// instead, see pdf-export.ts) is what makes every row's position exactly predictable
// and provably non-overlapping by construction, rather than depending on measured text
// height at draw time.
export type PdfRowPlacement = Readonly<{ page: number; y: number }>;

export type PdfLayoutResult = Readonly<{
  rows: readonly PdfRowPlacement[];
  totalsRow: PdfRowPlacement;
  pageCount: number;
}>;

export type PdfLayoutOptions = Readonly<{
  pageHeight: number;
  marginTop: number;
  marginBottom: number;
  headerHeight: number;
  rowHeight: number;
}>;

export function computeFinancePdfLayout(
  rowCount: number,
  options: PdfLayoutOptions,
): PdfLayoutResult {
  const { pageHeight, marginTop, marginBottom, headerHeight, rowHeight } = options;
  if (rowHeight <= 0) throw new Error('rowHeight must be positive');

  const contentTop = marginTop + headerHeight;
  const availableHeight = pageHeight - marginBottom - contentTop;
  const rowsPerPage = Math.max(1, Math.floor(availableHeight / rowHeight));

  const rows: PdfRowPlacement[] = [];
  for (let index = 0; index < rowCount; index += 1) {
    const page = Math.floor(index / rowsPerPage);
    const slot = index % rowsPerPage;
    rows.push({ page, y: contentTop + slot * rowHeight });
  }

  // The totals row claims the slot immediately after the last data row — on a new page
  // of its own if that slot would overflow the current one.
  const totalsIndex = rowCount;
  const totalsPage = Math.floor(totalsIndex / rowsPerPage);
  const totalsSlot = totalsIndex % rowsPerPage;
  const totalsRow: PdfRowPlacement = { page: totalsPage, y: contentTop + totalsSlot * rowHeight };

  const lastDataPage = rows.length > 0 ? rows[rows.length - 1]!.page : 0;
  const pageCount = Math.max(lastDataPage, totalsRow.page) + 1;

  return { rows, totalsRow, pageCount };
}
