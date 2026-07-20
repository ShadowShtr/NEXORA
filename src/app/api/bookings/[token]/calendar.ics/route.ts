import { NextResponse } from 'next/server';
import { resolveBookingByToken } from '@/lib/booking-token-lookup';
import { generateIcsEvent } from '@/lib/ics';
import { checkBookingLookupRateLimit } from '@/lib/rate-limit';
import { getRequestIp } from '@/lib/request-ip';

function notFoundResponse() {
  return NextResponse.json(
    { error: { code: 'NOT_FOUND', message: 'Marcação não encontrada.' } },
    { status: 404, headers: { 'Cache-Control': 'no-store' } },
  );
}

function formatAddress(business: {
  addressLine: string | null;
  postalCode: string | null;
  locality: string | null;
}): string | undefined {
  const parts = [
    business.addressLine,
    [business.postalCode, business.locality].filter(Boolean).join(' '),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

// NEX-072: "GET /api/bookings/{token}/calendar.ics" (docs/06_API_CONTRACTS.md) — reuses
// the same token resolution and uniform-404 behavior as NEX-071
// (resolveBookingByToken, src/lib/booking-token-lookup.ts). UID is the appointment's own
// id: stable across re-downloads of the same event (re-importing the file updates the
// existing calendar entry instead of duplicating it), and never reused for a different
// appointment. Timezone: DTSTART/DTEND are emitted in UTC (src/lib/ics.ts), which every
// major calendar client converts to the viewer's local time correctly — no dependency
// on the tenant's own timezone setting needed here, since start_at/end_at are already
// absolute instants.
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

  const summary = booking.business.professionalName
    ? `Marcação — ${booking.business.professionalName}`
    : `Marcação — ${booking.business.name}`;
  const description =
    booking.items.length > 0 ? booking.items.map((item) => item.description).join(', ') : undefined;

  const ics = generateIcsEvent({
    uid: `${booking.id}@nexora`,
    startAtIso: booking.startAt,
    endAtIso: booking.endAt,
    summary,
    description,
    location: formatAddress(booking.business),
  });

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="marcacao.ics"',
      'Cache-Control': 'no-store',
    },
  });
}
