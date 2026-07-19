// NEX-110: "valor final e cash/MBWAY/pending em poucos toques." The quick panel only
// ever offers these three outcomes — 'refunded' is not reachable from here, it only
// exists as a payment_status for a later correction flow (NEX-115).
export type QuickPaymentChoice = 'cash' | 'mbway' | 'pending';

export interface CompletionPayment {
  status: 'paid' | 'pending';
  method: 'cash' | 'mbway' | null;
}

// Mirrors the payments table's own check constraint (0001_initial.sql: status='pending'
// iff method is null) — kept here as a single source of truth the client and the RPC
// call both derive from, rather than duplicating the pairing logic ad hoc.
export function resolvePaymentFromChoice(choice: QuickPaymentChoice): CompletionPayment {
  if (choice === 'pending') return { status: 'pending', method: null };
  return { status: 'paid', method: choice };
}

// Money is integer cents everywhere in this codebase (CLAUDE.md) — parses a euro
// string from a <input type="number" step="0.01"> field into cents without ever
// going through floating-point euro arithmetic. Returns null for anything that isn't
// a valid non-negative amount, so the caller can reject rather than silently clamp.
export function parseEurosToCents(value: string): number | null {
  const trimmed = value.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [wholePart, fractionPart = ''] = trimmed.split('.');
  const cents = Number(wholePart) * 100 + Number(fractionPart.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}
