export interface BundleFile {
  name: string;
  bytes: number;
}

export interface BundleBudgetResult {
  totalKib: number;
  largest: { name: string; bytes: number };
  violations: string[];
  passed: boolean;
}

export function evaluateBundleBudget(options: {
  files: BundleFile[];
  totalBudgetKib: number;
  maxChunkBudgetKib: number;
}): BundleBudgetResult;
