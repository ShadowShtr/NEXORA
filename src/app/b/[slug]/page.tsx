import { notFound } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Phone, User } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { createClient } from '@/lib/supabase/server';
import { resolveLocationUrl } from '@/lib/open-location';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0]![0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function whatsappLink(phoneE164: string, businessName: string) {
  const digits = phoneE164.replace('+', '');
  const text = encodeURIComponent(
    `Olá! Vim através da página de ${businessName} e gostava de marcar.`,
  );
  return `https://wa.me/${digits}?text=${text}`;
}

export default async function PublicBusinessPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('slug', slug)
    .maybeSingle();
  if (!tenant) notFound();

  const { data: settings } = await supabase
    .from('business_settings')
    .select(
      'professional_name, phone_e164, address_line, postal_code, locality, maps_url, timezone',
    )
    .eq('tenant_id', tenant.id)
    .maybeSingle();

  // No `published_at` (business_settings) means the public policies (status='active',
  // published_at is not null) never matched in the first place — settings will be null.
  if (!settings) notFound();

  const locationUrl = resolveLocationUrl(settings.maps_url, {
    addressLine: settings.address_line,
    postalCode: settings.postal_code,
    locality: settings.locality,
  });

  return (
    <main className="shell stack public-landing">
      {/* No cover-photo upload exists yet (out of scope of this pass) — a brand-toned
          gradient banner stands in for it, matching the reference's proportions
          (docs/UI_SCREEN_SPECIFICATIONS.md #03) without pretending there's a real photo. */}
      <div className="public-cover">
        <div className="public-cover-avatar" aria-hidden="true">
          {initials(settings.professional_name || tenant.name)}
        </div>
      </div>

      <Card className="public-header">
        <p className="text-eyebrow">{tenant.name}</p>
        <h1 className="text-title">{settings.professional_name}</h1>
        <div className="public-info-rows">
          <div className="public-info-row">
            <span className="public-info-icon" aria-hidden="true">
              <User size={20} />
            </span>
            <span className="public-info-primary">{settings.professional_name}</span>
          </div>
          <div className="public-info-row">
            <span className="public-info-icon" aria-hidden="true">
              <MapPin size={20} />
            </span>
            <span>
              <span className="public-info-primary">{settings.address_line}</span>
              <span className="public-info-secondary">
                {settings.postal_code} {settings.locality}
              </span>
            </span>
          </div>
          {settings.phone_e164 ? (
            <div className="public-info-row">
              <span className="public-info-icon" aria-hidden="true">
                <Phone size={20} />
              </span>
              <span className="public-info-primary">{settings.phone_e164}</span>
            </div>
          ) : null}
          {locationUrl ? (
            <a
              href={locationUrl}
              target="_blank"
              rel="noreferrer"
              className="public-info-row public-info-row-link"
            >
              <span className="public-info-icon" aria-hidden="true">
                <MapPin size={20} />
              </span>
              <span className="public-info-primary">Ver no mapa</span>
            </a>
          ) : null}
        </div>
      </Card>

      {/* Visual refinement mid-2026: entry point into the multi-page flow
          (/servicos → /horario → /dados → /resumo) instead of a scroll-reveal single
          page — "Começar" is the one decision this screen asks for. */}
      <Card className="public-summary">
        <p className="text-eyebrow">Comece agora o seu pré-cadastro</p>
        <p className="text-support">É rápido e ajuda-nos a personalizar a sua experiência.</p>
        <Link href={`/b/${slug}/servicos`} className="button link-button">
          Começar
        </Link>
      </Card>

      {/* Contact footer: at the end of the page, not competing with the header for
          attention — a visitor who wants to skip the self-service flow and talk to the
          dona directly can, but it's the secondary path, not the first thing shown. */}
      {settings.phone_e164 || locationUrl ? (
        <div className="public-contact-footer">
          <p className="text-meta public-contact-footer-label">Prefere combinar diretamente?</p>
          <div className="public-contact-row">
            {settings.phone_e164 ? (
              <a
                className="public-contact-button"
                href={whatsappLink(settings.phone_e164, tenant.name)}
              >
                <span aria-hidden="true">💬</span>
                WhatsApp
              </a>
            ) : null}
            {settings.phone_e164 ? (
              <a className="public-contact-button" href={`tel:${settings.phone_e164}`}>
                <span aria-hidden="true">📞</span>
                Ligar
              </a>
            ) : null}
            {locationUrl ? (
              <a
                className="public-contact-button"
                href={locationUrl}
                target="_blank"
                rel="noreferrer"
              >
                <span aria-hidden="true">📍</span>
                Mapa
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
