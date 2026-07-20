'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatInTimeZone } from 'date-fns-tz';
import { pt } from 'date-fns/locale/pt';
import { ArrowLeft, CalendarDays, Clock, SquareCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { initials } from '@/lib/initials';
import { BookingConfirmation } from '../BookingConfirmation';
import { createPublicBooking } from '../booking-actions';
import { generateIdempotencyKey } from '../domain/idempotency-key';
import { useBookingSession } from '../useBookingSession';
import {
  cartLines,
  cartTotals,
  type PackageOption,
  type ServiceLine,
} from '../domain/booking-selection';

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
  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<{
    bookingToken: string;
    lookupCode: string;
  } | null>(null);

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

  async function handleConfirm() {
    if (!state.registration || !state.selectedSlotIso) return;
    setIsBooking(true);
    setBookingError(null);

    let result;
    try {
      result = await createPublicBooking({
        tenantId,
        registration: state.registration,
        selectedServiceIds: state.selectedServiceIds,
        selectedPackageId: state.selectedPackageId,
        startAtIso: state.selectedSlotIso,
        idempotencyKey,
        observation: observation.trim() || undefined,
      });
    } catch {
      setIsBooking(false);
      setBookingError('Não foi possível concluir a marcação. Tente novamente.');
      return;
    }

    setIsBooking(false);

    if (!result.ok) {
      if (result.error.code === 'SLOT_TAKEN') {
        persist({ ...state, selectedSlotIso: null });
        router.push(`/b/${tenantSlug}/horario?slotTaken=1`);
        return;
      }
      setBookingError(result.error.message);
      return;
    }

    clear();
    if (result.value.bookingToken && result.value.lookupCode) {
      setConfirmedBooking({
        bookingToken: result.value.bookingToken,
        lookupCode: result.value.lookupCode,
      });
    }
  }

  if (!ready || lines.length === 0 || !state.selectedSlotIso || !state.registration) return null;

  if (confirmedBooking) {
    return (
      <BookingConfirmation
        bookingToken={confirmedBooking.bookingToken}
        lookupCode={confirmedBooking.lookupCode}
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
    <div className="public-booking-content">
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
        {bookingError ? (
          <p role="alert" className="form-error">
            {bookingError}
          </p>
        ) : null}
        <Button
          type="button"
          disabled={isBooking}
          onClick={() => void handleConfirm()}
          className="public-resumo-confirm"
        >
          {isBooking ? 'A confirmar…' : 'Confirmar marcação'}
        </Button>
      </div>
    </div>
  );
}
