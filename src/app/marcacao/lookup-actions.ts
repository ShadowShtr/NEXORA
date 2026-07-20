'use server';

import { z } from 'zod';
import { resolveBookingByLookupCode, type ResolvedBookingByCode } from '@/lib/booking-lookup-code';
import { checkBookingLookupRateLimit } from '@/lib/rate-limit';
import { getRequestIp } from '@/lib/request-ip';
import type { Result } from '@/lib/result';

const requestSchema = z.object({
  code: z.string().trim().min(1).max(16),
});

// "Consultar marcação por código" — reuses the existing bookingLookup rate limiter
// (60/min, src/lib/rate-limit.ts) that was already sized for GET /api/bookings/{token}'s
// own defense-in-depth against enumeration. That limiter's own comment calls the 256-bit
// token "impractical to brute force on its own" — the 8-char lookup code is a smaller
// space (~1e12, still far beyond any realistic brute-force budget, see
// 0018_booking_lookup_code.sql's own reasoning), so the same generous-but-present cap
// applies here as one more layer, not the only one.
//
// Returns the full booking detail directly rather than an id/token to navigate to with:
// the plaintext booking_token can't be reconstructed from the lookup code (it's never
// stored, same discipline as everywhere else in this codebase), and minting a second
// permanent unauthenticated URL keyed by raw appointment_id would create a new
// never-expiring pseudo-credential this feature never intended to hand out. Rendered
// inline on the same page instead.
export async function lookupBookingByCode(
  _prevState: Result<ResolvedBookingByCode> | null,
  formData: FormData,
): Promise<Result<ResolvedBookingByCode>> {
  const parsed = requestSchema.safeParse({ code: formData.get('code') });
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Código inválido.' } };
  }

  const ip = await getRequestIp();
  const rateLimit = await checkBookingLookupRateLimit(ip);
  if (rateLimit.limited) {
    return {
      ok: false,
      error: { code: 'RATE_LIMITED', message: 'Demasiados pedidos. Tente novamente em breve.' },
    };
  }

  const booking = await resolveBookingByLookupCode(parsed.data.code);
  if (!booking) {
    return {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Código não encontrado. Verifique e tente novamente.' },
    };
  }

  return { ok: true, value: booking };
}
