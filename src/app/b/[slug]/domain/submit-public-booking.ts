import type { PublicBookingResult } from './public-booking-result';

export type SubmitPublicBookingInput = {
  registration: { name: string; phone: string; email?: string | undefined };
  selectedServiceIds: string[];
  selectedPackageId: string | null;
  startAtIso: string;
  idempotencyKey: string;
  observation?: string | undefined;
  turnstileToken?: string | undefined;
};

// NEX-BOOKING-RACE-001 follow-up: plain fetch() wrapper, independent of React, so it can
// be unit-tested without rendering ResumoClient and so the "read body, parse JSON,
// classify by HTTP status" logic lives in exactly one place. response.text() first (not
// response.json() directly) so a non-JSON body — an empty 204, an HTML error page from a
// proxy/edge layer, a truncated stream — fails with a clear diagnostic instead of an
// opaque "Unexpected end of JSON input" and instead of silently hanging on a body the
// caller never finishes reading.
export async function submitPublicBooking(
  slug: string,
  input: SubmitPublicBookingInput,
  signal?: AbortSignal,
): Promise<PublicBookingResult> {
  const response = await fetch(`/api/public/business/${encodeURIComponent(slug)}/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(input),
    signal: signal ?? null,
    cache: 'no-store',
  });

  const rawBody = await response.text();

  let parsed: unknown;
  try {
    parsed = rawBody.length > 0 ? JSON.parse(rawBody) : null;
  } catch {
    throw new Error(`Invalid booking response body: HTTP ${response.status}`);
  }

  const result = asPublicBookingResult(parsed);
  if (!result) {
    throw new Error(`Unrecognized booking response shape: HTTP ${response.status}`);
  }
  return result;
}

const VALID_ERROR_CODES = new Set([
  'SLOT_TAKEN',
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'IDEMPOTENCY_CONFLICT',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
]);

// The route handler returns PublicBookingResult directly as the response body (see
// route.ts) — this only re-validates the shape at the client boundary rather than
// trusting `as PublicBookingResult` on unknown network input.
function asPublicBookingResult(parsed: unknown): PublicBookingResult | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const body = parsed as Record<string, unknown>;

  if (
    body.ok === true &&
    body.code === 'BOOKING_CREATED' &&
    typeof body.appointmentId === 'string'
  ) {
    return {
      ok: true,
      code: 'BOOKING_CREATED',
      appointmentId: body.appointmentId,
      bookingToken: typeof body.bookingToken === 'string' ? body.bookingToken : null,
      lookupCode: typeof body.lookupCode === 'string' ? body.lookupCode : null,
      isReplay: body.isReplay === true,
    };
  }

  if (
    body.ok === false &&
    typeof body.code === 'string' &&
    VALID_ERROR_CODES.has(body.code) &&
    typeof body.message === 'string'
  ) {
    return {
      ok: false,
      code: body.code as Exclude<PublicBookingResult['code'], 'BOOKING_CREATED'>,
      message: body.message,
    };
  }

  return null;
}
