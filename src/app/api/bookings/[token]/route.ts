import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkBookingLookupRateLimit } from '@/lib/rate-limit';
import { getRequestIp } from '@/lib/request-ip';

const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// docs/05_SECURITY_PRIVACY.md, T3 "Enumeração de links": an attacker trying random
// tokens must see the exact same response (shape, status code, timing budget) whether
// the token is malformed, well-formed-but-unknown, or points at another tenant's
// marcação — any difference is a signal that helps them narrow the search. This is why
// every failure path below returns the identical 404 body, and why the hash comparison
// itself (once a row is found) still goes through timingSafeEqual rather than a plain
// string compare that could short-circuit at the first differing byte.
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

  if (!TOKEN_PATTERN.test(token)) {
    return notFoundResponse();
  }

  const admin = createAdminClient();
  const tokenHash = hashToken(token);

  const { data: appointment } = await admin
    .from('appointments')
    .select(
      'id, tenant_id, status, start_at, end_at, expected_total_cents, final_total_cents, booking_token_hash',
    )
    .eq('booking_token_hash', tokenHash)
    .maybeSingle();

  if (!appointment) {
    return notFoundResponse();
  }

  // Defense in depth: booking_token_hash is already a unique-indexed exact-match lookup
  // (fast, not attacker-controlled timing-wise on its own), but comparing the retrieved
  // hash back against the computed one via timingSafeEqual costs nothing and removes
  // any doubt about the DB layer's own comparison semantics.
  const storedHash = Buffer.from(appointment.booking_token_hash, 'hex');
  const computedHash = Buffer.from(tokenHash, 'hex');
  if (storedHash.length !== computedHash.length || !timingSafeEqual(storedHash, computedHash)) {
    return notFoundResponse();
  }

  const [{ data: tenant }, { data: items }] = await Promise.all([
    admin
      .from('tenants')
      .select('name, business_settings(professional_name, address_line, postal_code, locality)')
      .eq('id', appointment.tenant_id)
      .maybeSingle(),
    admin
      .from('appointment_items')
      .select('description, unit_price_cents, quantity')
      .eq('appointment_id', appointment.id),
  ]);

  if (!tenant) {
    return notFoundResponse();
  }

  const settings = Array.isArray(tenant.business_settings)
    ? tenant.business_settings[0]
    : tenant.business_settings;

  return NextResponse.json(
    {
      data: {
        status: appointment.status,
        startAt: appointment.start_at,
        endAt: appointment.end_at,
        totalCents: appointment.final_total_cents ?? appointment.expected_total_cents,
        business: {
          name: tenant.name,
          professionalName: settings?.professional_name ?? null,
          addressLine: settings?.address_line ?? null,
          postalCode: settings?.postal_code ?? null,
          locality: settings?.locality ?? null,
        },
        items: (items ?? []).map((item) => ({
          description: item.description,
          unitPriceCents: item.unit_price_cents,
          quantity: item.quantity,
        })),
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
