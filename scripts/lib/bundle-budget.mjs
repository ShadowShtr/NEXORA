// Pure evaluation logic for the NEX-155 bundle-size budget, split out of
// scripts/check-bundle-budget.mjs so it can be unit-tested (tests/unit/bundle-budget.test.ts)
// without touching the filesystem or process.exit.
export function evaluateBundleBudget({ files, totalBudgetKib, maxChunkBudgetKib }) {
  let totalBytes = 0;
  let largest = { name: '', bytes: 0 };
  for (const file of files) {
    totalBytes += file.bytes;
    if (file.bytes > largest.bytes) largest = { name: file.name, bytes: file.bytes };
  }

  const totalKib = totalBytes / 1024;
  const largestKib = largest.bytes / 1024;

  const violations = [];
  if (totalKib > totalBudgetKib) {
    violations.push(
      `Total JS bundle (${totalKib.toFixed(1)} KiB) exceeds budget (${totalBudgetKib} KiB).`,
    );
  }
  if (largestKib > maxChunkBudgetKib) {
    violations.push(
      `Largest chunk ${largest.name} (${largestKib.toFixed(1)} KiB) exceeds per-chunk budget (${maxChunkBudgetKib} KiB).`,
    );
  }

  return { totalKib, largest, violations, passed: violations.length === 0 };
}
