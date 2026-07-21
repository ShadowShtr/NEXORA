import type { CSSProperties } from 'react';
import Link from 'next/link';
import { CalendarClock, ChevronRight } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { initials } from '@/lib/initials';

export type ClientCardData = {
  id: string;
  name: string;
  phoneE164: string;
  lastAppointmentMs: number | null;
  totalSpentCents: number;
};

function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

// Visual refinement mid-2026 — Clientes reference: every card carries real,
// tenant-scoped data only. lastAppointmentMs comes from the most recent *completed*
// appointment (page.tsx), never fabricated; totalSpentCents sums actual paid payments.
// A client with neither yet (booked but never serviced/paid) simply omits those rows
// rather than showing a fake "€0,00" — that distinction matters to the dona.
export function ClientCard({
  client,
  timezone,
  style,
}: {
  client: ClientCardData;
  timezone: string;
  style?: CSSProperties;
}) {
  return (
    <li className="client-card-item" style={style}>
      <Link href={`/dashboard/clientes/${client.id}`} className="client-card">
        <span className="client-avatar-wrapper" aria-hidden="true">
          {initials(client.name)}
        </span>
        <span className="client-main-info">
          <span className="client-name">{client.name}</span>
          <span className="client-phone">{client.phoneE164}</span>
          {client.lastAppointmentMs !== null ? (
            <span className="client-meta-row">
              <CalendarClock aria-hidden="true" />
              {formatInTimeZone(client.lastAppointmentMs, timezone, 'dd/MM/yyyy HH:mm')}
            </span>
          ) : null}
        </span>
        {client.totalSpentCents > 0 ? (
          <span className="client-total">
            <span className="client-total-value">{formatEuros(client.totalSpentCents)}</span>
            <span className="client-total-label">Total gasto</span>
          </span>
        ) : (
          <span className="client-total" />
        )}
        <span className="client-chevron">
          <ChevronRight aria-hidden="true" />
        </span>
      </Link>
    </li>
  );
}
