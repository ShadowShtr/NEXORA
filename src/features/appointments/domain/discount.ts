// NEX-112: "Descontos fixos/percentuais... motivo opcional, limites e total nunca
// negativo." This mirrors the clamping logic in complete_appointment
// (0017_complete_appointment_discount.sql) purely for client-side preview — the RPC is
// the actual authority, this is only so the completion panel can show a live "valor com
// desconto" before submitting.
export type DiscountType = 'fixed' | 'percent';

export interface Discount {
  type: DiscountType;
  value: number;
  reason: string;
}

// Rounds like the RPC's round() (round-half-away-from-zero on a non-negative value —
// both branches here are always >= 0, so JS's default round-half-up behavior matches
// Postgres's round() exactly for every input this function is ever called with).
export function computeDiscountCents(discount: Discount, baseCents: number): number {
  const raw = discount.type === 'fixed' ? discount.value : (baseCents * discount.value) / 100;
  const rounded = Math.round(raw);
  // "Total nunca negativo": the discount can never exceed the amount it's discounting
  // from, and can never itself be negative (a negative "discount" would be a hidden
  // surcharge, out of scope for this control).
  return Math.min(Math.max(rounded, 0), baseCents);
}

export function applyDiscount(discount: Discount | null, baseCents: number): number {
  if (discount === null) return baseCents;
  return baseCents - computeDiscountCents(discount, baseCents);
}

export function isValidDiscountValue(type: DiscountType, value: number): boolean {
  if (!Number.isFinite(value) || value <= 0) return false;
  if (type === 'percent' && value > 100) return false;
  return true;
}
