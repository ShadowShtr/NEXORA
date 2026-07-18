import { NextResponse } from 'next/server';
import { resolveBookingByToken } from '@/lib/booking-token-lookup';
import { resolveLocationUrl } from '@/lib/open-location';
import { checkBookingLookupRateLimit } from '@/lib/rate-limit';
import { getRequestIp } from '@/lib/request-ip';

// docs/05_SECURITY_PRIVACY.md, T3 "Enumeração de links": an attacker trying random
// tokens must see the exact same response (shape, status code) whether the token is
// malformed, well-formed-but-unknown, or points at another tenant's marcação — any
// difference is a signal that helps them narrow the search. resolveBookingByToken
// (src/lib/booking-token-lookup.ts) already collapses every one of those cases to
// `null`, so this route only ever has one not-found shape to return.
function notFoundResponse() {
  return NextResponse.json(
    { error: { code: 'NOT_FOUND', message: 'Marcação não encontrada.' } },
    { status: 404, headers: { 'Cache-Control': 'no-store' } },
  );
}

// NEX-071: "GET /api/bookings/{token}" (docs/06_API_CONTRACTS.md) — the public,
// unauthenticated view a client reaches from their confirmation screen (NEX-070) or a
// saved link. Returns only what docs/01_PRODUCT_REQUIREMENTS.md §3.12 calls the
// mínima: business name/address, the booked items, the appointment's own date/time and
// current status — never the client's phone/e-mail (docs/05_SECURITY_PRIVACY.md: "Não
// incluir nome/telemóvel na URL" extends to not leaking it via the token's payload
// either, since anyone who obtains the link could otherwise read another person's
// contact details).
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const ip = await getRequestIp();
  const rateLimit = await checkBookingLookupRateLimit(ip);
  if (rateLimit.limited) {
    return NextResponse.json(
      { error: { code: 'RATE_LIMITED', message: 'Demasiados pedidos. Tente novamente em breve.' } },
      { status: 429, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const booking = await resolveBookingByToken(token);
  if (!booking) return notFoundResponse();

  // NEX-073: resolved server-side (owner's own maps_url when safe, otherwise a search
  // link built from the address) so the client never has to reimplement that fallback.
  const locationUrl = resolveLocationUrl(booking.business.mapsUrl, {
    addressLine: booking.business.addressLine,
    postalCode: booking.business.postalCode,
    locality: booking.business.locality,
  });

  return NextResponse.json(
    {
      data: {
        status: booking.status,
        startAt: booking.startAt,
        endAt: booking.endAt,
        totalCents: booking.totalCents,
        business: {
          name: booking.business.name,
          professionalName: booking.business.professionalName,
          addressLine: booking.business.addressLine,
          postalCode: booking.business.postalCode,
          locality: booking.business.locality,
          locationUrl,
        },
        items: booking.items,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
