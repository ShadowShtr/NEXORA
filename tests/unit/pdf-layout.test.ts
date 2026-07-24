import { describe, expect, it } from 'vitest';
import { computeFinancePdfLayout } from '@/features/finance/domain/pdf-layout';

const OPTIONS = {
  pageHeight: 800,
  marginTop: 40,
  marginBottom: 40,
  headerHeight: 60,
  rowHeight: 20,
};

function assertNoOverlapsWithinEachPage(
  placements: readonly { page: number; y: number }[],
  rowHeight: number,
) {
  const byPage = new Map<number, number[]>();
  for (const placement of placements) {
    const ys = byPage.get(placement.page) ?? [];
    ys.push(placement.y);
    byPage.set(placement.page, ys);
  }
  for (const ys of byPage.values()) {
    const sorted = [...ys].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i]! - sorted[i - 1]!).toBeGreaterThanOrEqual(rowHeight);
    }
  }
}

function assertFitsWithinPage(y: number, rowHeight: number) {
  expect(y + rowHeight).toBeLessThanOrEqual(OPTIONS.pageHeight - OPTIONS.marginBottom);
}

describe('computeFinancePdfLayout', () => {
  it('places every row on page 0 when they all fit on one page', () => {
    const layout = computeFinancePdfLayout(5, OPTIONS);
    expect(layout.pageCount).toBe(1);
    expect(layout.rows.every((row) => row.page === 0)).toBe(true);
    expect(layout.totalsRow.page).toBe(0);
  });

  it('no two rows on the same page share a y position, and every row fits within its page', () => {
    const layout = computeFinancePdfLayout(200, OPTIONS);
    assertNoOverlapsWithinEachPage([...layout.rows, layout.totalsRow], OPTIONS.rowHeight);
    for (const row of [...layout.rows, layout.totalsRow]) {
      assertFitsWithinPage(row.y, OPTIONS.rowHeight);
    }
  });

  it('spills onto a new page once a page is full, continuing at the top of the content area', () => {
    // Available height = 800 - 100(top+header) - 40(bottom) = 660; rowsPerPage = 33.
    const layout = computeFinancePdfLayout(40, OPTIONS);
    expect(layout.pageCount).toBe(2);
    const lastRowOnPage0 = layout.rows.filter((r) => r.page === 0).at(-1)!;
    const firstRowOnPage1 = layout.rows.find((r) => r.page === 1)!;
    expect(firstRowOnPage1.y).toBe(OPTIONS.marginTop + OPTIONS.headerHeight);
    expect(firstRowOnPage1.y).toBeLessThan(lastRowOnPage0.y);
  });

  it('moves the totals row to its own new page when it would overflow the last data page', () => {
    // rowsPerPage = 33 — exactly 33 data rows fill page 0 completely, leaving no slot
    // for the totals row on that page.
    const layout = computeFinancePdfLayout(33, OPTIONS);
    expect(layout.rows.every((row) => row.page === 0)).toBe(true);
    expect(layout.totalsRow.page).toBe(1);
    expect(layout.totalsRow.y).toBe(OPTIONS.marginTop + OPTIONS.headerHeight);
    expect(layout.pageCount).toBe(2);
  });

  it('handles zero rows — just the totals row on page 0', () => {
    const layout = computeFinancePdfLayout(0, OPTIONS);
    expect(layout.rows).toHaveLength(0);
    expect(layout.totalsRow.page).toBe(0);
    expect(layout.pageCount).toBe(1);
  });

  it('rejects a non-positive rowHeight', () => {
    expect(() => computeFinancePdfLayout(1, { ...OPTIONS, rowHeight: 0 })).toThrow(
      'rowHeight must be positive',
    );
  });
});
