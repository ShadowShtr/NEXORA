import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { createClient } from '@/lib/supabase/server';
import { resolveLocationUrl } from '@/lib/open-location';

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
    <main className="shell stack">
      <Card className="public-header">
        <p className="text-eyebrow">{tenant.name}</p>
        <h1 className="text-title">{settings.professional_name}</h1>
        <p className="text-support public-address">
          {settings.address_line}, {settings.postal_code} {settings.locality}
        </p>
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
