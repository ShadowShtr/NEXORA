'use server';

import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { clientContactSchema } from '@/lib/validation/client';
import type { Result } from '@/lib/result';
import { checkBookingRateLimit } from '@/lib/rate-limit';
import { getRequestIp } from '@/lib/request-ip';
import { verifyTurnstileToken } from '@/lib/turnstile';
import { getEmailProvider } from '@/lib/email';
import { buildBookingConfirmationEmail } from '@/lib/email/booking-confirmation-template';
import { resolveBookingByToken } from '@/lib/booking-token-lookup';
import { logEvent } from '@/lib/logger';
import { severityForErrorCode } from '@/lib/metrics';
import { getRequestId } from '@/lib/request-id';

const requestSchema = z.object({
  tenantId: z.uuid(),
  registration: clientContactSchema,
  selectedServiceIds: z.array(z.uuid()),
  selectedPackageId: z.uuid().nullable(),
  startAtIso: z.iso.datetime(),
  // Generated client-side (crypto.randomUUID() or equivalent, 32 random bytes hex) and
  // held by the caller across retries — generating it inside this action instead would
  // mint a fresh key on every retry, defeating idempotency entirely.
  idempotencyKey: z.string().regex(/^[0-9a-f]{64}$/, 'idempotencyKey must be 64 hex chars'),
  // Absent when Turnstile isn't rendered client-side (NEXT_PUBLIC_TURNSTILE_SITE_KEY
  // unset, see TurnstileWidget.tsx) — verifyTurnstileToken already no-ops server-side in
  // that same case, so an empty string here is fine rather than a validation error.
  turnstileToken: z.string().optional(),
  observation: z.string().trim().max(2000).optional(),
});

export type CreateBookingRequest = z.infer<typeof requestSchema>;

// Public booking creation (NEX-064): delegates the actual work to
// create_public_booking (supabase/migrations/0007_create_public_booking.sql), a single
// security-definer transaction that upserts the client, snapshots priced/timed
// appointment_items from the live catalog, inserts the appointment (guarded against
// double-booking by appointments_no_overlap, NEX-063) and its 24h reminder. This action
// is a thin, validated boundary in front of that RPC — anon already has EXECUTE on it
// (the migration grants it directly, ADR-008-style), so a plain anon client would work
// too, but going through the service-role client keeps this consistent with every other
// public write in this feature (draft-actions.ts, NEX-052) and avoids depending on the
// browser session/cookie state that a server action call may or may not carry.
export async function createPublicBooking(request: CreateBookingRequest): Promise<
  Result<{
    appointmentId: string;
    bookingToken: string | null;
    lookupCode: string | null;
    isReplay: boolean;
  }>
> {
  const parsed = requestSchema.safeParse(request);
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } };
  }
  const {
    tenantId,
    registration,
    selectedServiceIds,
    selectedPackageId,
    startAtIso,
    idempotencyKey,
    turnstileToken,
    observation,
  } = parsed.data;

  const ip = await getRequestIp();
  const requestId = await getRequestId();

  const rateLimit = await checkBookingRateLimit(ip);
  if (rateLimit.limited) {
    logEvent(
      severityForErrorCode('RATE_LIMITED'),
      'booking.public.rate_limited',
      { tenantId },
      requestId,
    );
    return {
      ok: false,
      error: { code: 'RATE_LIMITED', message: 'Demasiados pedidos. Tente novamente em breve.' },
    };
  }

  const isHuman = await verifyTurnstileToken(turnstileToken ?? '', ip);
  if (!isHuman) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Verificação de segurança falhou. Tente novamente.',
      },
    };
  }

  type CreatePublicBookingRow = {
    appointment_id: string;
    booking_token: string | null;
    lookup_code: string | null;
    is_replay: boolean;
  };

  const admin = createAdminClient();
  const { data, error } = await admin
    .rpc('create_public_booking', {
      p_tenant_id: tenantId,
      p_client_name: registration.name,
      p_client_phone_e164: registration.phone,
      p_client_email: registration.email ?? null,
      p_selected_service_ids: selectedServiceIds,
      p_selected_package_id: selectedPackageId,
      p_start_at: startAtIso,
      p_idempotency_key: idempotencyKey,
      p_client_observation: observation || null,
    })
    .single<CreatePublicBookingRow>();

  if (error) {
    // NEX-171: "Métricas e alertas" — slot_conflict is the "conflict rate" metric,
    // logged at 'warn' (severityForErrorCode) since a losing bid on a taken slot is
    // an expected, already-handled outcome (public-booking-race.spec.ts), not
    // something to page anyone over. Anything falling through to INTERNAL_ERROR is
    // the one case that logs at 'error'.
    if (error.code === '23P01') {
      logEvent(
        severityForErrorCode('SLOT_TAKEN'),
        'booking.public.slot_conflict',
        { tenantId },
        requestId,
      );
      return {
        ok: false,
        error: { code: 'SLOT_TAKEN', message: 'Este horário acabou de ser reservado.' },
      };
    }
    if (error.code === '23505') {
      logEvent(
        severityForErrorCode('IDEMPOTENCY_CONFLICT'),
        'booking.public.idempotency_conflict',
        { tenantId },
        requestId,
      );
      return {
        ok: false,
        error: {
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'Este pedido já foi processado com dados diferentes.',
        },
      };
    }
    if (error.code === '42501') {
      logEvent(
        severityForErrorCode('NOT_FOUND'),
        'booking.public.tenant_not_published',
        { tenantId },
        requestId,
      );
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Negócio não encontrado.' } };
    }
    logEvent(
      severityForErrorCode('INTERNAL_ERROR'),
      'booking.public.failed',
      { tenantId, code: error.code ?? 'unknown' },
      requestId,
    );
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível concluir a marcação.' },
    };
  }

  logEvent('info', 'booking.public.created', { tenantId, isReplay: data.is_replay }, requestId);

  // Fire-and-forget: booking success has already been decided above (the transaction
  // committed) and must never depend on e-mail delivery (task acceptance criteria:
  // "booking não depende de entrega"). Not awaited — the caller gets their confirmation
  // immediately regardless of how long/whether this succeeds. registration.email is
  // optional (docs/01_PRODUCT_REQUIREMENTS.md §3.2: "telemóvel e e-mail opcional"), so
  // this only fires when the client actually provided one.
  if (registration.email && !data.is_replay && data.booking_token && data.lookup_code) {
    void sendBookingConfirmationEmail(registration.email, data.booking_token, data.lookup_code);
  }

  return {
    ok: true,
    value: {
      appointmentId: data.appointment_id,
      bookingToken: data.booking_token,
      lookupCode: data.lookup_code,
      isReplay: data.is_replay,
    },
  };
}

async function sendBookingConfirmationEmail(
  email: string,
  bookingToken: string,
  lookupCode: string,
) {
  // resolveBookingByToken (src/lib/booking-token-lookup.ts, NEX-071) already resolves
  // tenant name/timezone and priced items from the token alone — reusing it here avoids
  // re-querying the same tables with slightly different shapes.
  const booking = await resolveBookingByToken(bookingToken);
  if (!booking) return;

  const message = buildBookingConfirmationEmail({
    to: email,
    businessName: booking.business.professionalName ?? booking.business.name,
    startAtIso: booking.startAt,
    timezone: booking.business.timezone,
    items: booking.items.map((item) => ({
      description: item.description,
      unitPriceCents: item.unitPriceCents,
    })),
    totalCents: booking.totalCents,
    bookingUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/marcacao/${bookingToken}`,
    lookupCode,
  });

  const provider = getEmailProvider();
  await provider.send(message);
}
