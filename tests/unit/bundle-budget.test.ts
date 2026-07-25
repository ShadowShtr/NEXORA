import { describe, expect, it } from 'vitest';
import { evaluateBundleBudget } from '../../scripts/lib/bundle-budget.mjs';

// NEX-155: "Performance e Web Vitals — budgets." Pure logic behind
// scripts/check-bundle-budget.mjs (wired into `npm run verify`, runs after `next build`).
describe('evaluateBundleBudget', () => {
  it('passes when total and largest chunk are within budget', () => {
    const result = evaluateBundleBudget({
      files: [
        { name: 'a.js', bytes: 100 * 1024 },
        { name: 'b.js', bytes: 200 * 1024 },
      ],
      totalBudgetKib: 500,
      maxChunkBudgetKib: 300,
    });
    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.totalKib).toBeCloseTo(300, 0);
    expect(result.largest).toEqual({ name: 'b.js', bytes: 200 * 1024 });
  });

  it('flags a total-size violation', () => {
    const result = evaluateBundleBudget({
      files: [{ name: 'a.js', bytes: 600 * 1024 }],
      totalBudgetKib: 500,
      maxChunkBudgetKib: 700,
    });
    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatch(/Total JS bundle/);
  });

  it('flags a single-chunk-too-large violation, independent of the total budget', () => {
    const result = evaluateBundleBudget({
      files: [{ name: 'huge.js', bytes: 450 * 1024 }],
      totalBudgetKib: 2500,
      maxChunkBudgetKib: 400,
    });
    expect(result.passed).toBe(false);
    expect(result.violations[0]).toMatch(/Largest chunk huge\.js/);
  });

  it('can report both violations at once', () => {
    const result = evaluateBundleBudget({
      files: [{ name: 'huge.js', bytes: 600 * 1024 }],
      totalBudgetKib: 500,
      maxChunkBudgetKib: 400,
    });
    expect(result.violations).toHaveLength(2);
  });

  it('handles an empty build gracefully', () => {
    const result = evaluateBundleBudget({ files: [], totalBudgetKib: 500, maxChunkBudgetKib: 400 });
    expect(result.passed).toBe(true);
    expect(result.totalKib).toBe(0);
  });
});
