'use client';

import { useActionState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { pt } from 'date-fns/locale/pt';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { lookupBookingByCode } from './lookup-actions';
import { resolveLocationUrl } from '@/lib/open-location';
import type { ResolvedBookingByCode } from '@/lib/booking-lookup-code';
import type { Result } from '@/lib/result';

function formatEuros(cents: number) {
  return (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

function capitalize(label: string): string {
  return label.length === 0 ? label : label[0]!.toUpperCase() + label.slice(1);
}

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmada',
  presence_confirmed: 'Confirmada',
  completed: 'Concluída',
  cancelled: 'Cancelada',
  no_show: 'Não compareceu',
};

function BookingResult({ booking }: { booking: ResolvedBookingByCode }) {
  const locationUrl = resolveLocationUrl(booking.business.mapsUrl, booking.business);
  const dateLabel = capitalize(
    formatInTimeZone(booking.startAt, booking.business.timezone, "EEEE, dd 'de' MMMM", {
      locale: pt,
    }),
  );
  const timeLabel = formatInTimeZone(booking.startAt, booking.business.timezone, 'HH:mm');

  return (
    <Card className="public-summary">
      <p className="text-eyebrow">{booking.business.professionalName ?? booking.business.name}</p>
      <p className="public-step-label">
        Marcação {STATUS_LABELS[booking.status] ?? booking.status}
      </p>
      <p className="text-numeral">
        {dateLabel} · {timeLabel}
      </p>
      <p className="text-support">Total: {formatEuros(booking.totalCents)}</p>
      {booking.business.addressLine ? (
        <p className="text-support">
          {booking.business.addressLine}, {booking.business.postalCode} {booking.business.locality}
        </p>
      ) : null}
      {locationUrl ? (
        <a
          className="button button-secondary link-button"
          href={locationUrl}
          target="_blank"
          rel="noreferrer"
        >
          Ver no mapa
        </a>
      ) : null}
    </Card>
  );
}

// "Consultar marcação por código" — code-only lookup (no phone/e-mail pairing, see
// 0018_booking_lookup_code.sql's own reasoning for why 8 characters alone is already a
// safe security margin). Renders the result inline rather than navigating anywhere,
// per lookup-actions.ts's own reasoning against minting a second permanent URL.
export function LookupForm() {
  const [state, formAction, pending] = useActionState<
    Result<ResolvedBookingByCode> | null,
    FormData
  >(lookupBookingByCode, null);

  if (state?.ok) {
    return <BookingResult booking={state.value} />;
  }

  return (
    <form action={formAction} className="stack">
      <label>
        Código da marcação
        <input
          name="code"
          required
          maxLength={16}
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="Ex: 7K4PXM2Q"
          className="lookup-code-input"
        />
      </label>
      {state && !state.ok ? (
        <p role="alert" className="form-error">
          {state.error.message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'A procurar…' : 'Consultar marcação'}
      </Button>
    </form>
  );
}
