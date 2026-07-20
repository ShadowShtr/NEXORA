import { createHash, timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export const BOOKING_TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export function hashBookingToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export type ResolvedBooking = {
  id: string;
  status: string;
  startAt: string;
  endAt: string;
  totalCents: number;
  business: {
    name: string;
    professionalName: string | null;
    addressLine: string | null;
    postalCode: string | null;
    locality: string | null;
    mapsUrl: string | null;
    timezone: string;
  };
  items: { description: string; unitPriceCents: number; quantity: number }[];
};

// Shared by GET /api/bookings/{token} (NEX-071) and GET /api/bookings/{token}/calendar.ics
// (NEX-072) — both need the exact same token-to-appointment resolution and the same
// uniform-response-against-enumeration behavior (docs/05_SECURITY_PRIVACY.md, T3), so
// this is the one place that logic lives rather than being duplicated (and risking the
// two routes drifting apart on what counts as "not found").
export async function resolveBookingByToken(token: string): Promise<ResolvedBooking | null> {
  if (!BOOKING_TOKEN_PATTERN.test(token)) return null;

  const admin = createAdminClient();
  const tokenHash = hashBookingToken(token);

  const { data: appointment } = await admin
    .from('appointments')
    .select(
      'id, tenant_id, status, start_at, end_at, expected_total_cents, final_total_cents, booking_token_hash',
    )
    .eq('booking_token_hash', tokenHash)
    .maybeSingle();

  if (!appointment) return null;

  // Defense in depth: booking_token_hash is already a unique-indexed exact-match lookup
  // (fast, not attacker-controlled timing-wise on its own), but comparing the retrieved
  // hash back against the computed one via timingSafeEqual costs nothing and removes any
  // doubt about the DB layer's own comparison semantics.
  const storedHash = Buffer.from(appointment.booking_token_hash, 'hex');
  const computedHash = Buffer.from(tokenHash, 'hex');
  if (storedHash.length !== computedHash.length || !timingSafeEqual(storedHash, computedHash)) {
    return null;
  }

  const [{ data: tenant }, { data: items }] = await Promise.all([
    admin
      .from('tenants')
      .select(
        'name, business_settings(professional_name, address_line, postal_code, locality, maps_url, timezone)',
      )
      .eq('id', appointment.tenant_id)
      .maybeSingle(),
    admin
      .from('appointment_items')
      .select('description, unit_price_cents, quantity')
      .eq('appointment_id', appointment.id),
  ]);

  if (!tenant) return null;

  const settings = Array.isArray(tenant.business_settings)
    ? tenant.business_settings[0]
    : tenant.business_settings;

  return {
    id: appointment.id,
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
      mapsUrl: settings?.maps_url ?? null,
      timezone: settings?.timezone ?? 'Europe/Lisbon',
    },
    items: (items ?? []).map((item) => ({
      description: item.description,
      unitPriceCents: item.unit_price_cents,
      quantity: item.quantity,
    })),
  };
}
