'use client';

import { useEffect, useReducer, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatInTimeZone } from 'date-fns-tz';
import { pt } from 'date-fns/locale/pt';
import { ArrowLeft, CalendarDays, Clock, SquareCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { initials } from '@/lib/initials';
import { publicEnv } from '@/lib/env';
import { BookingConfirmation } from '../BookingConfirmation';
import { TurnstileWidget } from '../TurnstileWidget';
import { generateIdempotencyKey } from '../domain/idempotency-key';
import { useBookingSession } from '../useBookingSession';
import {
  cartLines,
  cartTotals,
  type PackageOption,
  type ServiceLine,
} from '../domain/booking-selection';
import { submitPublicBooking } from '../domain/submit-public-booking';
import { confirmationReducer, INITIAL_CONFIRMATION_STATE } from '../domain/confirmation-state';

const SUBMIT_TIMEOUT_MS = 10_000;

// Temporary diagnostic trail for NEX-BOOKING-RACE-001: numbered markers so a failing
// Playwright run (page.on('console')) pinpoints exactly which step the confirm handler
// reached. Gated behind NEXT_PUBLIC_BOOKING_DEBUG (read directly, not added to the
// zod-validated env schema — this flag is temporary and gets deleted with this block
// once the race is confirmed fixed across 20/20 concurrent runs).
const DEBUG = process.env.NEXT_PUBLIC_BOOKING_DEBUG === '1';
function debugLog(step: string, requestId: string, ...rest: unknown[]) {
  if (DEBUG) console.info(`[booking:${step}]`, requestId, ...rest);
}

function formatEuros(cents: number) {
  return (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

function capitalize(label: string): string {
  return label.length === 0 ? label : label[0]!.toUpperCase() + label.slice(1);
}

// Visual refinement mid-2026: step 4 (final) of the paginated public flow — requires
// registration already completed (redirects back to /dados otherwise). Idempotency key
// is minted once per page visit (lazy useState initializer, not per click) so a retry
// after a transient failure reuses the same key instead of defeating idempotency.
export function ResumoClient({
  tenantId,
  tenantSlug,
  businessName,
  professionalName,
  phoneE164,
  addressLine,
  postalCode,
  locality,
  timezone,
  locationUrl,
  services,
  packages,
}: {
  tenantId: string;
  tenantSlug: string;
  businessName: string;
  professionalName: string | null;
  phoneE164: string | null;
  addressLine: string | null;
  postalCode: string | null;
  locality: string | null;
  timezone: string;
  locationUrl: string | null;
  services: ServiceLine[];
  packages: PackageOption[];
}) {
  const router = useRouter();
  const { state, ready, persist, clear } = useBookingSession(tenantId, tenantSlug);
  const [observation, setObservation] = useState('');
  const [idempotencyKey] = useState(() => generateIdempotencyKey());
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileSiteKey = publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [confirmation, dispatch] = useReducer(confirmationReducer, INITIAL_CONFIRMATION_STATE);
  // Guards against a second overlapping submission from this same tab (double-click,
  // Enter+click) — separate from `confirmation.status` because it must be readable
  // synchronously inside the same handler invocation, before React commits the next
  // render.
  const submittingRef = useRef(false);

  const servicesById = new Map(services.map((service) => [service.id, service]));
  const lines = cartLines(
    { selectedPackageId: state.selectedPackageId, selectedServiceIds: state.selectedServiceIds },
    servicesById,
    packages,
  );
  const { totalCents } = cartTotals(lines);

  useEffect(() => {
    if (!ready) return;
    if (lines.length === 0) {
      router.replace(`/b/${tenantSlug}/servicos`);
      return;
    }
    if (!state.selectedSlotIso) {
      router.replace(`/b/${tenantSlug}/horario`);
      return;
    }
    if (!state.registration) {
      router.replace(`/b/${tenantSlug}/dados`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // A plain HTTP POST (docs/06_API_CONTRACTS.md) via submitPublicBooking, not a Server
  // Action — Next.js Server Actions are processed sequentially per server instance and
  // don't reliably deliver a response back to the client under genuine concurrent
  // invocations (NEX-BOOKING-RACE-001: two simultaneous confirms for the same slot both
  // completed server-side within ~100ms — one success, one the expected conflict — but
  // neither browser ever received its response while this called createPublicBooking as
  // an action). See src/app/api/public/business/[slug]/bookings/route.ts. Deliberately
  // not wrapped in startTransition: this is a network request with a real outcome the
  // user is waiting on, not a deferrable visual update.
  async function handleConfirm() {
    if (!state.registration || !state.selectedSlotIso) return;
    if (submittingRef.current) return;

    const requestId = idempotencyKey.slice(0, 8);
    submittingRef.current = true;
    debugLog('01:submit-started', requestId);
    dispatch({ type: 'SUBMIT_STARTED' });

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);

    try {
      debugLog('02:fetch-started', requestId);
      const result = await submitPublicBooking(
        tenantSlug,
        {
          registration: state.registration,
          selectedServiceIds: state.selectedServiceIds,
          selectedPackageId: state.selectedPackageId,
          startAtIso: state.selectedSlotIso,
          idempotencyKey,
          observation: observation.trim() || undefined,
          turnstileToken: turnstileToken ?? undefined,
        },
        controller.signal,
      );
      debugLog('03:result-received', requestId, result.ok, result.code);

      dispatch({ type: 'RESULT_RECEIVED', result });

      if (result.ok) {
        clear();
        debugLog('04:success-no-navigation', requestId);
        return;
      }

      if (result.code === 'SLOT_TAKEN') {
        persist({ ...state, selectedSlotIso: null });
        debugLog('04:conflict-navigating', requestId);
        router.push(`/b/${tenantSlug}/horario?slotTaken=1`);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        debugLog('05:timed-out', requestId);
        dispatch({ type: 'TIMED_OUT' });
        return;
      }
      debugLog('05:request-failed', requestId, error);
      dispatch({
        type: 'REQUEST_FAILED',
        message: error instanceof Error ? error.message : 'Não foi possível concluir a marcação.',
      });
    } finally {
      window.clearTimeout(timeoutId);
      submittingRef.current = false;
      debugLog('06:handler-finally', requestId);
    }
  }

  if (!ready || lines.length === 0 || !state.selectedSlotIso || !state.registration) return null;

  if (confirmation.status === 'success') {
    return (
      <BookingConfirmation
        bookingToken={confirmation.bookingToken}
        lookupCode={confirmation.lookupCode}
        locationUrl={locationUrl}
        phoneE164={phoneE164}
        businessName={businessName}
        addressLine={addressLine}
        postalCode={postalCode}
        locality={locality}
        startAtIso={state.selectedSlotIso}
        timezone={timezone}
        totalCents={totalCents}
      />
    );
  }

  return (
    // A <main> landmark, not a plain <div> — same axe finding (landmark-one-main/region)
    // already fixed once for the root public page (src/app/b/[slug]/page.tsx) applies
    // to every step of the paginated flow, not just the profile page.
    <main className="public-booking-content">
      <header className="public-step-header">
        <Link href={`/b/${tenantSlug}/dados`} className="nx-icon-button" aria-label="Voltar">
          <ArrowLeft aria-hidden="true" />
        </Link>
        <h1 className="text-title">Resumo da marcação</h1>
      </header>

      <div className="card">
        <p className="public-step-label">Serviços</p>
        <ul className="public-service-list">
          {lines.map((line) => (
            <li key={line.id} className="public-service-item">
              <span className="public-resumo-service-name">
                <SquareCheck className="public-resumo-service-icon" size={16} aria-hidden="true" />
                {line.name}
              </span>
              <span className="public-service-meta">{formatEuros(line.priceCents)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <p className="public-step-label">Data e horário</p>
        <div className="public-datetime-row">
          <CalendarDays size={16} aria-hidden="true" />
          <span>
            {capitalize(
              formatInTimeZone(state.selectedSlotIso, timezone, "EEEE, dd 'de' MMMM 'de' yyyy", {
                locale: pt,
              }),
            )}
          </span>
        </div>
        <div className="public-datetime-row">
          <Clock size={16} aria-hidden="true" />
          <span>{formatInTimeZone(state.selectedSlotIso, timezone, 'HH:mm')}</span>
        </div>
      </div>

      {professionalName ? (
        <div className="card">
          <p className="public-step-label">Profissional</p>
          <div className="public-professional-row">
            <span className="public-professional-avatar" aria-hidden="true">
              {initials(professionalName)}
            </span>
            <span className="public-professional-name">{professionalName}</span>
          </div>
        </div>
      ) : null}

      <div className="card">
        <label>
          Observações (opcional)
          <textarea
            value={observation}
            onChange={(event) => setObservation(event.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Alguma observação ou pedido especial?"
          />
        </label>
      </div>

      <div className="public-resumo-footer">
        <div className="public-resumo-total-row">
          <span className="text-support">Total estimado</span>
          <span className="public-resumo-total-value">{formatEuros(totalCents)}</span>
        </div>
        {turnstileSiteKey ? (
          <TurnstileWidget siteKey={turnstileSiteKey} onToken={setTurnstileToken} />
        ) : null}
        {confirmation.status === 'error' ? (
          <p role="alert" className="form-error">
            {confirmation.message}
          </p>
        ) : null}
        <Button
          type="button"
          disabled={
            confirmation.status === 'submitting' ||
            (turnstileSiteKey !== undefined && !turnstileToken)
          }
          onClick={() => void handleConfirm()}
          className="public-resumo-confirm"
        >
          {confirmation.status === 'submitting' ? 'A confirmar…' : 'Confirmar marcação'}
        </Button>
      </div>
    </main>
  );
}
