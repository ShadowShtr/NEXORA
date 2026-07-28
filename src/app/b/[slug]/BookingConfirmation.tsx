'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatInTimeZone } from 'date-fns-tz';
import { pt } from 'date-fns/locale/pt';
import { Calendar, Check, Coins, Copy, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/Card';

function whatsappLink(phoneE164: string, businessName: string) {
  const digits = phoneE164.replace('+', '');
  const text = encodeURIComponent(
    `Olá! Acabei de marcar através da página de ${businessName}. Fico a aguardar confirmação, obrigada!`,
  );
  return `https://wa.me/${digits}?text=${text}`;
}

function formatEuros(cents: number) {
  return (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

function capitalize(label: string): string {
  return label.length === 0 ? label : label[0]!.toUpperCase() + label.slice(1);
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
// Visual refinement mid-2026: three summary cards (date/time, business+address, price)
// above the actions, each an icon badge + text row reusing the same
// .public-info-icon/.public-info-row primitives as the public landing page, and every
// action as an equal-weight full-width button (only "Ver marcação" stays visually
// primary) instead of the earlier row of small icon buttons.
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
  addressLine,
  postalCode,
  locality,
  startAtIso,
  timezone,
  totalCents,
}: {
  bookingToken: string;
  lookupCode: string;
  locationUrl: string | null;
  phoneE164: string | null;
  businessName: string;
  addressLine: string | null;
  postalCode: string | null;
  locality: string | null;
  startAtIso: string;
  timezone: string;
  totalCents: number;
}) {
  const [copied, setCopied] = useState(false);

  // Clipboard write requires a secure context (https, or localhost in dev) — silently
  // no-ops the confirmation on failure rather than throwing, since the code is still
  // visible and selectable as plain text either way.
  async function copyLookupCode() {
    try {
      await navigator.clipboard.writeText(lookupCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable/denied — the code remains visible to copy manually.
    }
  }

  return (
    // A <main> landmark — this screen replaces ResumoClient's own <main> entirely once
    // the booking is confirmed (see the confirmedBooking branch in ResumoClient.tsx), so
    // it needs to carry the landmark itself rather than relying on a parent element.
    <main>
      <Card className="public-confirmation">
        <div className="public-confirmation-icon" aria-hidden="true">
          <Check size={40} strokeWidth={3} />
        </div>
        <h2 className="text-title">Marcação confirmada com sucesso!</h2>
        <p className="text-support public-confirmation-lead">
          Enviámos os detalhes para o seu WhatsApp e email.
        </p>

        <div className="public-confirmation-details">
          <div className="card">
            <div className="public-info-row">
              <span className="public-info-icon" aria-hidden="true">
                <Calendar size={18} />
              </span>
              <span>
                <span className="public-info-primary">
                  {capitalize(
                    formatInTimeZone(startAtIso, timezone, "EEEE, dd 'de' MMMM", { locale: pt }),
                  )}
                </span>
                <span className="public-info-secondary">
                  {formatInTimeZone(startAtIso, timezone, 'HH:mm')}
                </span>
              </span>
            </div>
          </div>

          <div className="card">
            <div className="public-info-row">
              <span className="public-info-icon" aria-hidden="true">
                <MapPin size={18} />
              </span>
              <span>
                <span className="public-info-primary">{businessName}</span>
                {addressLine ? <span className="public-info-secondary">{addressLine}</span> : null}
                {postalCode || locality ? (
                  <span className="public-info-secondary">
                    {postalCode} {locality}
                  </span>
                ) : null}
              </span>
            </div>
          </div>

          <div className="card">
            <div className="public-info-row">
              <span className="public-info-icon" aria-hidden="true">
                <Coins size={18} />
              </span>
              <span>
                <span className="public-info-primary">{formatEuros(totalCents)}</span>
                <span className="public-info-secondary">Valor estimado</span>
              </span>
            </div>
          </div>
        </div>

        <a
          className="button link-button public-confirmation-primary"
          href={`/marcacao/${bookingToken}`}
        >
          Ver marcação
        </a>
        <a
          className="button button-secondary link-button public-confirmation-secondary"
          href={`/api/bookings/${bookingToken}/calendar.ics`}
        >
          Adicionar ao calendário
        </a>
        {locationUrl ? (
          <a
            className="button button-secondary link-button public-confirmation-secondary"
            href={locationUrl}
            target="_blank"
            rel="noreferrer"
          >
            Abrir localização
          </a>
        ) : null}
        {phoneE164 ? (
          <a
            className="button button-secondary link-button public-confirmation-secondary"
            href={whatsappLink(phoneE164, businessName)}
            target="_blank"
            rel="noreferrer"
          >
            Contactar por WhatsApp
          </a>
        ) : null}

        <div className="public-lookup-code">
          <p className="text-meta">Guarde este código para consultar a marcação mais tarde:</p>
          <div className="public-lookup-code-row">
            <p className="public-lookup-code-value">{lookupCode}</p>
            <button
              type="button"
              className="public-lookup-code-copy"
              onClick={() => void copyLookupCode()}
              aria-label="Copiar código"
            >
              <Copy size={16} aria-hidden="true" />
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
          <p className="text-support">
            Em <Link href="/marcacao">nexora.app/marcacao</Link>, sem precisar deste link.
          </p>
        </div>
      </Card>
    </main>
  );
}
