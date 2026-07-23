import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AtSign, Calendar, ChevronRight, MapPin, MessageCircle, Phone, User } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { resolveLocationUrl } from '@/lib/open-location';
import { initials } from '@/lib/initials';
import { buildWhatsappDeepLink } from '@/features/appointments/domain/appointment-card';
import { buildWeeklyHoursLines, resolveTodayHoursSummary } from './domain/hours-summary';
import { PublicHoursRow } from './PublicHoursRow';
import { PublicAboutSection } from './PublicAboutSection';

// get_public_business_hours (0030_business_public_profile.sql) isn't a table select, so
// postgrest-js has no column list to structurally type its result against on this
// schema-less client — spelled out explicitly here, same reasoning as
// booking-lookup-code.ts's LookupRow for resolve_booking_lookup_code.
type PublicBusinessHourRow = {
  day_of_week: number;
  is_open: boolean;
  opens_at: string | null;
  closes_at: string | null;
};

// NEX-050 visual refinement — página pública inicial: "a cliente deve entender
// imediatamente qual é o negócio, quem vai atendê-la, morada, contacto, horário e como
// começar uma marcação." requireProfile() is never called here on purpose — this route
// is the one page in the app meant for a visitor with no session at all; every query
// below relies on the anon RLS policies already proven since NEX-012/NEX-035
// (tenants.status='active', business_settings.published_at is not null,
// services/packages.is_active, service_categories.is_visible).
async function loadPublicProfile(slug: string) {
  const supabase = await createClient();

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('slug', slug)
    .maybeSingle();
  // A genuine query error (bad connection, missing column/table) must never be treated
  // the same as "no matching tenant" — that would silently show visitors a false
  // "página não disponível" for what is actually an outage or a migration that wasn't
  // applied in this environment, exactly the kind of failure that must stay loud.
  if (tenantError)
    throw new Error(`loadPublicProfile: tenants query failed: ${tenantError.message}`);
  if (!tenant) return null;

  const { data: settings, error: settingsError } = await supabase
    .from('business_settings')
    .select(
      'professional_name, phone_e164, address_line, postal_code, locality, maps_url, timezone, specialty, about_description, instagram_handle, logo_path, cover_image_path, booking_enabled',
    )
    .eq('tenant_id', tenant.id)
    .maybeSingle();
  if (settingsError) {
    throw new Error(`loadPublicProfile: business_settings query failed: ${settingsError.message}`);
  }
  // No `published_at` (business_settings) means the public policies (status='active',
  // published_at is not null) never matched in the first place — settings will be null.
  if (!settings) return null;

  const [{ data: hoursRows }, { count: activeServicesCount }, { count: activePackagesCount }] =
    await Promise.all([
      // business_hours has no anon policy of its own by design (docs/04_DATA_MODEL.md)
      // — this narrow security-definer RPC (0030_business_public_profile.sql) is the
      // only public window into it, same minimal-surface pattern as the availability
      // engine's own RPC.
      supabase.rpc('get_public_business_hours', { p_tenant_id: tenant.id }),
      supabase
        .from('services')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('is_active', true),
      supabase
        .from('packages')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('is_active', true),
    ]);

  const logoUrl = settings.logo_path
    ? supabase.storage.from('business-logos').getPublicUrl(settings.logo_path).data.publicUrl
    : null;
  const coverUrl = settings.cover_image_path
    ? supabase.storage.from('business-covers').getPublicUrl(settings.cover_image_path).data
        .publicUrl
    : null;

  return {
    tenant,
    settings,
    // Cast rather than .returns<T[]>(): postgrest-js's generic constraint on that
    // helper can't tell (on this schema-less client) that this RPC returns a set, not
    // a single row, and rejects the array shape at the type level either way.
    hoursRows: (hoursRows ?? []) as PublicBusinessHourRow[],
    hasActiveCatalog: (activeServicesCount ?? 0) + (activePackagesCount ?? 0) > 0,
    logoUrl,
    coverUrl,
    // Read here, inside a plain async function the component calls once — not in the
    // component body itself, where the React Compiler purity rule forbids it (same
    // convention as dashboard/page.tsx's loadDashboardData).
    nowMs: Date.now(),
  };
}

export default async function PublicBusinessPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = await loadPublicProfile(slug);
  if (!profile) notFound();

  const { tenant, settings, hoursRows, hasActiveCatalog, logoUrl, coverUrl, nowMs } = profile;
  const timezone = settings.timezone ?? 'Europe/Lisbon';
  const hoursSummary = resolveTodayHoursSummary(
    hoursRows.map((row) => ({
      dayOfWeek: row.day_of_week,
      isOpen: row.is_open,
      opensAt: row.opens_at,
      closesAt: row.closes_at,
    })),
    timezone,
    nowMs,
  );
  const weeklyLines = buildWeeklyHoursLines(
    hoursRows.map((row) => ({
      dayOfWeek: row.day_of_week,
      isOpen: row.is_open,
      opensAt: row.opens_at,
      closesAt: row.closes_at,
    })),
  );

  const locationUrl = resolveLocationUrl(settings.maps_url, {
    addressLine: settings.address_line,
    postalCode: settings.postal_code,
    locality: settings.locality,
  });
  const whatsappHref = settings.phone_e164
    ? buildWhatsappDeepLink(
        settings.phone_e164,
        `Olá! Vim através da página de ${tenant.name} e gostava de marcar.`,
      )
    : null;
  const localityLine = [settings.postal_code, settings.locality].filter(Boolean).join(' ');

  return (
    <div className="public-profile-page">
      <div className="public-cover">
        {coverUrl ? (
          // Public bucket URL, not an asset next/image needs to sign or refresh.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" className="public-cover-image" />
        ) : null}
      </div>

      <div className="public-profile-content">
        <div className="public-business-logo-wrapper">
          {logoUrl ? (
            // Public bucket URL, not an asset next/image needs to sign or refresh.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={tenant.name} className="public-business-logo" />
          ) : (
            <span className="public-business-logo-fallback" aria-hidden="true">
              {initials(tenant.name)}
            </span>
          )}
        </div>

        <h1 className="public-business-name">{tenant.name}</h1>
        {settings.specialty ? (
          <p className="public-business-category">{settings.specialty}</p>
        ) : null}

        <div className="public-information-card">
          {settings.professional_name ? (
            <div className="public-information-row">
              <span className="public-information-icon" aria-hidden="true">
                <User size={19} />
              </span>
              <span className="public-information-text">
                <span className="public-information-primary">{settings.professional_name}</span>
                <span className="public-information-secondary">Profissional</span>
              </span>
            </div>
          ) : null}

          {settings.address_line ? (
            locationUrl ? (
              <a
                href={locationUrl}
                target="_blank"
                rel="noreferrer"
                className="public-information-row public-information-row-link"
              >
                <span className="public-information-icon" aria-hidden="true">
                  <MapPin size={19} />
                </span>
                <span className="public-information-text">
                  <span className="public-information-primary">{settings.address_line}</span>
                  {localityLine ? (
                    <span className="public-information-secondary">{localityLine}</span>
                  ) : null}
                </span>
                <ChevronRight aria-hidden="true" size={18} className="public-information-chevron" />
              </a>
            ) : (
              <div className="public-information-row">
                <span className="public-information-icon" aria-hidden="true">
                  <MapPin size={19} />
                </span>
                <span className="public-information-text">
                  <span className="public-information-primary">{settings.address_line}</span>
                  {localityLine ? (
                    <span className="public-information-secondary">{localityLine}</span>
                  ) : null}
                </span>
              </div>
            )
          ) : null}

          {settings.phone_e164 ? (
            <a
              href={`tel:${settings.phone_e164}`}
              className="public-information-row public-information-row-link"
            >
              <span className="public-information-icon" aria-hidden="true">
                <Phone size={19} />
              </span>
              <span className="public-information-text">
                <span className="public-information-primary">{settings.phone_e164}</span>
                <span className="public-information-secondary">Telefone e WhatsApp</span>
              </span>
            </a>
          ) : null}

          <PublicHoursRow summary={hoursSummary} weeklyLines={weeklyLines} />
        </div>

        <div className="public-quick-actions">
          {whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="public-quick-action"
              data-type="whatsapp"
            >
              <span className="public-quick-action-icon" aria-hidden="true">
                <MessageCircle size={19} />
              </span>
              <span className="public-quick-action-label">WhatsApp</span>
            </a>
          ) : null}
          {settings.instagram_handle ? (
            <a
              href={`https://instagram.com/${settings.instagram_handle}`}
              target="_blank"
              rel="noreferrer"
              className="public-quick-action"
              data-type="instagram"
            >
              <span className="public-quick-action-icon" aria-hidden="true">
                <AtSign size={19} />
              </span>
              <span className="public-quick-action-label">Instagram</span>
            </a>
          ) : null}
          {locationUrl ? (
            <a
              href={locationUrl}
              target="_blank"
              rel="noreferrer"
              className="public-quick-action"
              data-type="location"
            >
              <span className="public-quick-action-icon" aria-hidden="true">
                <MapPin size={19} />
              </span>
              <span className="public-quick-action-label">Como chegar</span>
            </a>
          ) : null}
        </div>

        {settings.about_description ? (
          <PublicAboutSection description={settings.about_description} />
        ) : null}

        {/* "A NEXORA é a plataforma. O destaque da página pública deve ser o negócio da
            profissional" — discreet footer credit, not the platform's own branding
            competing for attention anywhere above. */}
        <p className="public-platform-credit">Marcações através da NEXORA</p>
      </div>

      <div className="public-booking-footer">
        {!hasActiveCatalog ? (
          <p className="public-booking-unavailable">Os serviços estão a ser preparados.</p>
        ) : !settings.booking_enabled ? (
          whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="public-booking-button"
            >
              <MessageCircle aria-hidden="true" size={20} />
              Contactar profissional
            </a>
          ) : (
            <p className="public-booking-unavailable">
              Marcações online temporariamente indisponíveis.
            </p>
          )
        ) : (
          <Link href={`/b/${slug}/servicos`} className="public-booking-button">
            <Calendar aria-hidden="true" size={20} />
            Fazer marcação
          </Link>
        )}
      </div>
    </div>
  );
}
