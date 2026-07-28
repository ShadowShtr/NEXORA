// 32 random bytes as lowercase hex (64 chars), matching the shape
// POST /api/public/business/[slug]/bookings validates. Generated once per booking
// attempt and held across retries by the caller — a fresh key per retry would defeat
// the idempotency check in create_public_booking (NEX-064).
export function generateIdempotencyKey(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
