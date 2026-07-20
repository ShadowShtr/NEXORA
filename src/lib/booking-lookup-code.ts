import { createAdminClient } from '@/lib/supabase/admin';
import { BOOKING_LOOKUP_CODE_PATTERN } from '@/lib/booking-lookup-code-pattern';

export { BOOKING_LOOKUP_CODE_PATTERN };

export type ResolvedBookingByCode = {
  appointmentId: string;
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
};

type LookupRow = {
  appointment_id: string;
  status: string;
  start_at: string;
  end_at: string;
  total_cents: number;
  tenant_name: string;
  professional_name: string | null;
  address_line: string | null;
  postal_code: string | null;
  locality: string | null;
  maps_url: string | null;
  timezone: string | null;
};

// Mirrors resolveBookingByToken's own shape/behavior (src/lib/booking-token-lookup.ts)
// as closely as this different lookup key allows: uniform null on any miss (malformed
// code, unknown code) so a caller can never distinguish "well-formed but wrong" from
// "garbage input" by response shape alone (docs/05_SECURITY_PRIVACY.md, T3). Calls
// resolve_booking_lookup_code (0018_booking_lookup_code.sql) via the admin client — the
// RPC is anon-grantable but this keeps the same "always go through admin client for
// public writes/reads" convention the rest of this feature already follows
// (draft-actions.ts, booking-actions.ts).
export async function resolveBookingByLookupCode(
  code: string,
): Promise<ResolvedBookingByCode | null> {
  if (!BOOKING_LOOKUP_CODE_PATTERN.test(code)) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .rpc('resolve_booking_lookup_code', { p_code: code.toUpperCase() })
    .maybeSingle<LookupRow>();

  if (error || !data) return null;

  return {
    appointmentId: data.appointment_id,
    status: data.status,
    startAt: data.start_at,
    endAt: data.end_at,
    totalCents: data.total_cents,
    business: {
      name: data.tenant_name,
      professionalName: data.professional_name,
      addressLine: data.address_line,
      postalCode: data.postal_code,
      locality: data.locality,
      mapsUrl: data.maps_url,
      timezone: data.timezone ?? 'Europe/Lisbon',
    },
  };
}
