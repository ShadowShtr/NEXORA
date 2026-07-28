import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { clientContactSchema } from '@/lib/validation/client';
import { checkBookingRateLimit } from '@/lib/rate-limit';
import { getRequestIp } from '@/lib/request-ip';
import { verifyTurnstileToken } from '@/lib/turnstile';
import { getEmailProvider } from '@/lib/email';
import { buildBookingConfirmationEmail } from '@/lib/email/booking-confirmation-template';
import { resolveBookingByToken } from '@/lib/booking-token-lookup';
import { logEvent } from '@/lib/logger';
import { severityForErrorCode } from '@/lib/metrics';
import { getRequestId } from '@/lib/request-id';
import type { PublicBookingResult } from '@/app/b/[slug]/domain/public-booking-result';

const requestSchema = z.object({
  registration: clientContactSchema,
  selectedServiceIds: z.array(z.uuid()),
  selectedPackageId: z.uuid().nullable(),
  startAtIso: z.iso.datetime(),
  // Generated client-side (crypto.randomUUID() or equivalent, 32 random bytes hex) and
  // held by the caller across retries — generating it inside this route instead would
  // mint a fresh key on every retry, defeating idempotency entirely.
  idempotencyKey: z.string().regex(/^[0-9a-f]{64}$/, 'idempotencyKey must be 64 hex chars'),
  // Absent when Turnstile isn't rendered client-side (NEXT_PUBLIC_TURNSTILE_SITE_KEY
  // unset, see TurnstileWidget.tsx) — verifyTurnstileToken already no-ops server-side in
  // that same case, so an empty string here is fine rather than a validation error.
  turnstileToken: z.string().optional(),
  observation: z.string().trim().max(2000).optional(),
});

const ERROR_STATUS: Record<string, number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  SLOT_TAKEN: 409,
  IDEMPOTENCY_CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

function errorResponse(
  code: Exclude<PublicBookingResult['code'], 'BOOKING_CREATED'>,
  message: string,
) {
  return NextResponse.json({ ok: false, code, message } satisfies PublicBookingResult, {
    status: ERROR_STATUS[code] ?? 500,
    headers: { 'Cache-Control': 'no-store' },
  });
}

// docs/06_API_CONTRACTS.md: "POST /api/public/business/{slug}/bookings" — a Route
// Handler, not a Server Action, deliberately. This used to be createPublicBooking, a
// Server Action called directly from ResumoClient.tsx; NEX-BOOKING-RACE-001 found that
// Next.js Server Actions are processed sequentially per server instance and don't
// reliably deliver a response back to the client under genuine concurrent invocations
// (confirmed empirically: two simultaneous confirms for the same slot both completed
// server-side within ~100ms — one success, one the expected 23P01 conflict, per
// create_public_booking's own logging — but neither browser ever received its response;
// see public-booking-race.spec.ts and https://github.com/vercel/next.js/issues/69265).
// A plain HTTP POST via fetch() doesn't share that limitation, and matches what this
// endpoint was already documented (not yet implemented) to be.
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const admin = createAdminClient();
  const { data: tenant } = await admin.from('tenants').select('id').eq('slug', slug).maybeSingle();
  if (!tenant) return errorResponse('NOT_FOUND', 'Negócio não encontrado.');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('VALIDATION_ERROR', 'Dados inválidos.');
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse('VALIDATION_ERROR', 'Dados inválidos.');
  }
  const {
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
      { tenantId: tenant.id },
      requestId,
    );
    return errorResponse('RATE_LIMITED', 'Demasiados pedidos. Tente novamente em breve.');
  }

  const isHuman = await verifyTurnstileToken(turnstileToken ?? '', ip);
  if (!isHuman) {
    return errorResponse('VALIDATION_ERROR', 'Verificação de segurança falhou. Tente novamente.');
  }

  type CreatePublicBookingRow = {
    appointment_id: string;
    booking_token: string | null;
    lookup_code: string | null;
    is_replay: boolean;
  };

  const callCreatePublicBooking = () =>
    admin
      .rpc('create_public_booking', {
        p_tenant_id: tenant.id,
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

  const firstAttempt = await callCreatePublicBooking();

  // 40P01 (deadlock_detected): under real concurrent load, Postgres can pick this
  // transaction as the deadlock victim even though it isn't the one that should lose the
  // slot — the other transaction (whichever holds the lock the arbiter favors) proceeds
  // normally. A single retry is the standard remedy: by the time it re-runs, the
  // conflicting transaction has already committed or rolled back, so this resolves to
  // either a real booking or a real 23P01 SLOT_TAKEN, not another deadlock. Confirmed via
  // repeated 8-worker Playwright runs (tests/e2e/public-booking-race.spec.ts) — this is
  // the one failure mode idempotency alone doesn't cover, since it isn't a duplicate
  // request, it's Postgres aborting a legitimate first attempt.
  const shouldRetry = firstAttempt.error?.code === '40P01';
  if (shouldRetry) {
    logEvent('warn', 'booking.public.deadlock_retry', { tenantId: tenant.id }, requestId);
  }
  const { data, error } = shouldRetry ? await callCreatePublicBooking() : firstAttempt;

  if (error) {
    // NEX-171: "Métricas e alertas" — slot_conflict is the "conflict rate" metric,
    // logged at 'warn' (severityForErrorCode) since a losing bid on a taken slot is an
    // expected, already-handled outcome (public-booking-race.spec.ts), not something to
    // page anyone over. Anything falling through to INTERNAL_ERROR is the one case that
    // logs at 'error'.
    if (error.code === '23P01') {
      logEvent(
        severityForErrorCode('SLOT_TAKEN'),
        'booking.public.slot_conflict',
        { tenantId: tenant.id },
        requestId,
      );
      return errorResponse('SLOT_TAKEN', 'Este horário acabou de ser reservado.');
    }
    if (error.code === '23505') {
      logEvent(
        severityForErrorCode('IDEMPOTENCY_CONFLICT'),
        'booking.public.idempotency_conflict',
        { tenantId: tenant.id },
        requestId,
      );
      return errorResponse(
        'IDEMPOTENCY_CONFLICT',
        'Este pedido já foi processado com dados diferentes.',
      );
    }
    if (error.code === '42501') {
      logEvent(
        severityForErrorCode('NOT_FOUND'),
        'booking.public.tenant_not_published',
        { tenantId: tenant.id },
        requestId,
      );
      return errorResponse('NOT_FOUND', 'Negócio não encontrado.');
    }
    logEvent(
      severityForErrorCode('INTERNAL_ERROR'),
      'booking.public.failed',
      { tenantId: tenant.id, code: error.code ?? 'unknown' },
      requestId,
    );
    return errorResponse('INTERNAL_ERROR', 'Não foi possível concluir a marcação.');
  }

  logEvent(
    'info',
    'booking.public.created',
    { tenantId: tenant.id, isReplay: data.is_replay },
    requestId,
  );

  // Fire-and-forget: booking success has already been decided above (the transaction
  // committed) and must never depend on e-mail delivery (task acceptance criteria:
  // "booking não depende de entrega"). Not awaited — the caller gets their confirmation
  // immediately regardless of how long/whether this succeeds. registration.email is
  // optional (docs/01_PRODUCT_REQUIREMENTS.md §3.2: "telemóvel e e-mail opcional"), so
  // this only fires when the client actually provided one.
  if (registration.email && !data.is_replay && data.booking_token && data.lookup_code) {
    void sendBookingConfirmationEmail(registration.email, data.booking_token, data.lookup_code);
  }

  return NextResponse.json(
    {
      ok: true,
      code: 'BOOKING_CREATED',
      appointmentId: data.appointment_id,
      bookingToken: data.booking_token,
      lookupCode: data.lookup_code,
      isReplay: data.is_replay,
    } satisfies PublicBookingResult,
    { headers: { 'Cache-Control': 'no-store' } },
  );
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
