'use client';

import Link from 'next/link';
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
//
// "Ver marcação" is the one action with real informational weight (the full appointment
// detail page), so it's the sole full-width primary button — calendário/mapa/WhatsApp
// are secondary utility actions, shown as a row of equal-weight icon buttons rather
// than four stacked buttons that all look equally important when they aren't.
//
// lookupCode (NEX-095b): an 8-character code the client can use later at /marcacao to
// look the booking back up without needing this exact link — see
// src/lib/booking-lookup-code.ts for why 8 characters, not a shorter PIN.
export function BookingConfirmation({
  bookingToken,
  lookupCode,
  locationUrl,
  phoneE164,
  businessName,
}: {
  bookingToken: string;
  lookupCode: string;
  locationUrl: string | null;
  phoneE164: string | null;
  businessName: string;
}) {
  return (
    <Card className="public-confirmation">
      <div className="public-confirmation-icon" aria-hidden="true">
        ✓
      </div>
      <h2 className="text-title">Marcação confirmada</h2>
      <p className="text-support public-confirmation-lead">
        A sua marcação foi confirmada com sucesso.
      </p>

      <a
        className="button link-button public-confirmation-primary"
        href={`/marcacao/${bookingToken}`}
      >
        Ver marcação
      </a>

      <div className="public-contact-row">
        <a className="public-contact-button" href={`/api/bookings/${bookingToken}/calendar.ics`}>
          <span aria-hidden="true">📅</span>
          Calendário
        </a>
        {locationUrl ? (
          <a className="public-contact-button" href={locationUrl} target="_blank" rel="noreferrer">
            <span aria-hidden="true">📍</span>
            Mapa
          </a>
        ) : null}
        {phoneE164 ? (
          <a
            className="public-contact-button"
            href={whatsappLink(phoneE164, businessName)}
            target="_blank"
            rel="noreferrer"
          >
            <span aria-hidden="true">💬</span>
            WhatsApp
          </a>
        ) : null}
      </div>

      <div className="public-lookup-code">
        <p className="text-meta">Guarde este código para consultar a marcação mais tarde:</p>
        <p className="public-lookup-code-value">{lookupCode}</p>
        <p className="text-support">
          Em <Link href="/marcacao">nexora.app/marcacao</Link>, sem precisar deste link.
        </p>
      </div>
    </Card>
  );
}
