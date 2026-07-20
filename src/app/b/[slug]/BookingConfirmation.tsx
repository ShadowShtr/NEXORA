'use client';

import { Card } from '@/components/ui/Card';

function whatsappLink(phoneE164: string, businessName: string) {
  const digits = phoneE164.replace('+', '');
  const text = encodeURIComponent(
    `Olá! Acabei de marcar através da página de ${businessName}. Fico a aguardar confirmação, obrigada!`,
  );
  return `https://wa.me/${digits}?text=${text}`;
}

// NEX-070: "Ecrã final oferece: ver marcação, adicionar ao calendário e abrir
// localização" (docs/01_PRODUCT_REQUIREMENTS.md §3.12) — ver marcação (NEX-071's token
// resolution, rendered as a readable page at /marcacao/[token] rather than linking the
// raw JSON API), adicionar ao calendário (NEX-072, .../calendar.ics) and abrir
// localização (NEX-073, resolved server-side by the parent page — src/app/b/[slug]/page.tsx
// already computes this once for its own "Ver no mapa" button, so it's passed down
// instead of recomputed here). "Contactar WhatsApp" is a later visual-refinement
// addition: after confirming, the client can reach the dona directly for anything the
// automated flow can't handle (a last-minute question, a special request).
export function BookingConfirmation({
  bookingToken,
  locationUrl,
  phoneE164,
  businessName,
}: {
  bookingToken: string;
  locationUrl: string | null;
  phoneE164: string | null;
  businessName: string;
}) {
  return (
    <Card className="public-summary public-confirmation">
      <p className="public-step-label">Marcação confirmada</p>
      <p className="public-confirmation-lead">A sua marcação foi confirmada com sucesso.</p>
      <div className="public-confirmation-actions">
        <a className="button link-button" href={`/marcacao/${bookingToken}`}>
          Ver marcação
        </a>
        <a className="button link-button" href={`/api/bookings/${bookingToken}/calendar.ics`}>
          Adicionar ao calendário
        </a>
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
        {phoneE164 ? (
          <a
            className="button button-secondary link-button"
            href={whatsappLink(phoneE164, businessName)}
            target="_blank"
            rel="noreferrer"
          >
            Contactar WhatsApp
          </a>
        ) : null}
      </div>
    </Card>
  );
}
