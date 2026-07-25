import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { evaluateBundleBudget } from './lib/bundle-budget.mjs';

// NEX-155: "Performance e Web Vitals — budgets e otimização de bundle." Runs after
// `next build` (wired into `npm run verify`) and fails the build if the client JS
// bundle grows past a budget — the concrete, automatable half of "budgets"; the other
// half (Lighthouse/timing budgets) lives in lighthouse-budgets.json and is checked
// manually (Lighthouse needs a real browser, not available in this repo's CI).
// Thresholds set with real headroom over the measured baseline right after the
// NEX-150-154 CSS/design-system work (43 chunks, ~1.44 MiB total, largest ~277 KiB) —
// tight enough to catch an accidental heavy import landing in a shared client chunk,
// loose enough not to fail on normal, expected growth.
const TOTAL_BUDGET_KIB = 2500;
const MAX_CHUNK_BUDGET_KIB = 400;

const chunksDir = path.join(process.cwd(), '.next/static/chunks');
const files = readdirSync(chunksDir)
  .filter((f) => f.endsWith('.js'))
  .map((name) => ({ name, bytes: statSync(path.join(chunksDir, name)).size }));

const result = evaluateBundleBudget({
  files,
  totalBudgetKib: TOTAL_BUDGET_KIB,
  maxChunkBudgetKib: MAX_CHUNK_BUDGET_KIB,
});

console.log(
  `Bundle budget: ${files.length} chunks, ${result.totalKib.toFixed(1)} KiB total (budget ${TOTAL_BUDGET_KIB} KiB), largest ${result.largest.name} at ${(result.largest.bytes / 1024).toFixed(1)} KiB (budget ${MAX_CHUNK_BUDGET_KIB} KiB)`,
);

if (!result.passed) {
  for (const violation of result.violations) console.error(`✗ ${violation}`);
  process.exit(1);
}
console.log('✓ Bundle within budget.');
