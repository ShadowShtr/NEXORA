'use client';

import { Card } from '@/components/ui/Card';

// NEX-070: "Ecrã final oferece: ver marcação, adicionar ao calendário e abrir
// localização" (docs/01_PRODUCT_REQUIREMENTS.md §3.12) — the three actions this screen
// exists to deliver, each backed by a previously completed task: ver marcação
// (NEX-071's token resolution, rendered as a readable page at /marcacao/[token] rather
// than linking the raw JSON API), adicionar ao calendário (NEX-072,
// .../calendar.ics) and abrir localização (NEX-073, resolved server-side by the parent
// page — src/app/b/[slug]/page.tsx already computes this once for its own "Ver no
// mapa" button, so it's passed down instead of recomputed here).
export function BookingConfirmation({
  bookingToken,
  locationUrl,
}: {
  bookingToken: string;
  locationUrl: string | null;
}) {
  return (
    <Card className="public-summary">
      <p className="public-step-label">Marcação confirmada</p>
      <p>A sua marcação foi confirmada com sucesso.</p>
      <div className="public-confirmation-actions">
        <a className="button link-button" href={`/marcacao/${bookingToken}`}>
          Ver marcação
        </a>
        <a className="button link-button" href={`/api/bookings/${bookingToken}/calendar.ics`}>
          Adicionar ao calendário
        </a>
        {locationUrl ? (
          <a className="button link-button" href={locationUrl} target="_blank" rel="noreferrer">
            Ver no mapa
          </a>
        ) : null}
      </div>
    </Card>
  );
}
