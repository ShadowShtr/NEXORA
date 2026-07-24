import { notFound } from 'next/navigation';
import { formatInTimeZone } from 'date-fns-tz';
import { pt } from 'date-fns/locale/pt';
import { Card } from '@/components/ui/Card';
import { resolveBookingByToken } from '@/lib/booking-token-lookup';
import { resolveLocationUrl } from '@/lib/open-location';
import { checkBookingLookupRateLimit } from '@/lib/rate-limit';
import { getRequestIp } from '@/lib/request-ip';

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

// NEX-070/071: the human-readable "ver marcação" page a client reaches from their
// confirmation screen or ICS/link. Server Component reading resolveBookingByToken
// directly (src/lib/booking-token-lookup.ts) — the same resolution GET
// /api/bookings/{token} uses — rather than fetching that JSON API from here, since both
// already run server-side and there is no reason to add an HTTP round trip to itself.
// Rate-limited the same way as that API route (checkBookingLookupRateLimit, 60/min per
// IP): this page resolves the exact same token-keyed data, so it was an easier
// enumeration target than the API it duplicates without this check.
export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const ip = await getRequestIp();
  const rateLimit = await checkBookingLookupRateLimit(ip);
  if (rateLimit.limited) {
    return (
      <main className="shell stack">
        <Card className="public-summary">
          <p role="alert" className="form-error">
            Demasiados pedidos. Tente novamente em breve.
          </p>
        </Card>
      </main>
    );
  }

  const booking = await resolveBookingByToken(token);
  if (!booking) notFound();

  const locationUrl = resolveLocationUrl(booking.business.mapsUrl, booking.business);
  const dateLabel = capitalize(
    formatInTimeZone(booking.startAt, booking.business.timezone, "EEEE, dd 'de' MMMM", {
      locale: pt,
    }),
  );
  const timeLabel = formatInTimeZone(booking.startAt, booking.business.timezone, 'HH:mm');

  return (
    <main className="shell stack">
      <Card className="public-summary">
        <p className="eyebrow">{booking.business.professionalName ?? booking.business.name}</p>
        <p className="public-step-label">
          Marcação {STATUS_LABELS[booking.status] ?? booking.status}
        </p>
        <p className="public-summary-total">
          {dateLabel} · {timeLabel}
        </p>

        {booking.items.length > 0 ? (
          <ul className="public-service-list">
            {booking.items.map((item, index) => (
              <li key={index} className="public-service-item">
                <span>{item.description}</span>
                <span className="public-service-meta">{formatEuros(item.unitPriceCents)}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <p className="public-summary-total">Total: {formatEuros(booking.totalCents)}</p>

        {booking.business.addressLine ? (
          <p className="public-address">
            {booking.business.addressLine}, {booking.business.postalCode}{' '}
            {booking.business.locality}
          </p>
        ) : null}

        <div className="public-confirmation-actions">
          <a className="button link-button" href={`/api/bookings/${token}/calendar.ics`}>
            Adicionar ao calendário
          </a>
          {locationUrl ? (
            <a className="button link-button" href={locationUrl} target="_blank" rel="noreferrer">
              Ver no mapa
            </a>
          ) : null}
        </div>
      </Card>
    </main>
  );
}
