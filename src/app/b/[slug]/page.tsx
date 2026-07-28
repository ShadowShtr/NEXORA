import { cache } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { AtSign, Calendar, ChevronRight, MapPin, MessageCircle, Phone, User } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getOptionalProfile } from '@/lib/auth/require-profile';
import { resolveLocationUrl } from '@/lib/open-location';
import { initials } from '@/lib/initials';
import { publicEnv } from '@/lib/env';
import { publicBookingUrl } from '@/features/onboarding/domain/publish-step';
import { buildWhatsappDeepLink } from '@/features/appointments/domain/appointment-card';
import { buildWeeklyHoursLines, resolveTodayHoursSummary } from './domain/hours-summary';
import { PublicHoursRow } from './PublicHoursRow';
import { PublicAboutSection } from './PublicAboutSection';
import { PublicFeaturedServices, type FeaturedService } from './PublicFeaturedServices';
import { PublicShareButton } from './PublicShareButton';

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
//
// NEX-PUBLIC-404-001: wrapped in React's cache() so generateMetadata() below and the
// page component share one execution per request instead of querying twice — the
// reason generateMetadata calls this at all (rather than just the page component,
// like before) is that this route has a sibling loading.tsx (perceived-performance
// fix for the "Continuar" gap between steps). A loading.tsx makes Next start
// streaming the fallback shell — status 200 — immediately; notFound() called from
// deeper inside the page component after that point can still swap in the 404 UI,
// but the response's status line was already sent, so it stays 200 (confirmed live:
// curl against a slug that was never created returned 200, and disabling
// loading.tsx as a one-off experiment made it correctly return 404). generateMetadata
// runs and resolves *before* that shell streams, so notFound() called there — not
// just in the page component — is what actually fixes the status code.
async function loadPublicProfileUncached(slug: string) {
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
      'professional_name, phone_e164, address_line, postal_code, locality, maps_url, timezone, specialty, about_description, instagram_handle, logo_path, cover_image_path, booking_enabled, published_at',
    )
    .eq('tenant_id', tenant.id)
    .maybeSingle();
  if (settingsError) {
    throw new Error(`loadPublicProfile: business_settings query failed: ${settingsError.message}`);
  }
  // No `published_at` (business_settings) means the public policies (status='active',
  // published_at is not null) never matched in the first place — settings will be null
  // for a genuine anonymous visitor. It won't be null here for the tenant's own owner,
  // even pre-publish: her own authenticated tenant-scoped policy (business_settings_select,
  // 0001_initial.sql) grants access regardless of published_at, same as every other
  // table below except business_hours (see isOwnerPreview below).
  if (!settings) return null;

  // NEX-142: "Mudanças visuais sem publicar acidentalmente" — the owner must be able to
  // preview her own still-unpublished page. getOptionalProfile() never redirects (unlike
  // requireProfile()), so this stays safe for a genuine anonymous visitor.
  const viewerProfile = await getOptionalProfile();
  const isOwnerPreview = viewerProfile?.tenantId === tenant.id;

  const [
    { data: hoursRows },
    { count: activeServicesCount },
    { count: activePackagesCount },
    { data: featuredServiceRows },
  ] = await Promise.all([
    isOwnerPreview
      ? // Read the table directly: her own authenticated policy (business_hours_select,
        // tenant_id = current_tenant_id()) grants this regardless of published_at, unlike
        // the RPC below (security definer, hardcodes the published-only check for every
        // caller — NEX-166/0038 — so it can't tell the owner apart from a stranger).
        supabase
          .from('business_hours')
          .select('day_of_week, is_open, opens_at, closes_at')
          .eq('tenant_id', tenant.id)
      : // business_hours has no anon policy of its own by design (docs/04_DATA_MODEL.md)
        // — this narrow security-definer RPC (0030_business_public_profile.sql) is the
        // only public window into it for a genuine visitor, same minimal-surface pattern
        // as the availability engine's own RPC.
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
    // A taste of the catalogue before the visitor even taps "Fazer marcação" — same
    // services/is_active RLS policy the full catalogue page already relies on
    // (NEX-035), just capped to a handful and ordered the same way services are
    // managed (sort_order).
    supabase
      .from('services')
      .select('id, name, price_cents, duration_minutes')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('sort_order')
      .limit(4),
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
    featuredServices: (featuredServiceRows ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      priceCents: row.price_cents,
      durationMinutes: row.duration_minutes,
    })) satisfies FeaturedService[],
    isOwnerPreview,
    logoUrl,
    coverUrl,
    // Read here, inside a plain async function the component calls once — not in the
    // component body itself, where the React Compiler purity rule forbids it (same
    // convention as dashboard/page.tsx's loadDashboardData).
    nowMs: Date.now(),
  };
}
// Deduped per request: generateMetadata() and the page component below both need
// this, and without cache() that would mean two full round-trips instead of one.
const loadPublicProfile = cache(loadPublicProfileUncached);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const profile = await loadPublicProfile(slug);
  if (!profile) notFound();
  return { title: profile.tenant.name };
}

export default async function PublicBusinessPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = await loadPublicProfile(slug);
  if (!profile) notFound();

  const {
    tenant,
    settings,
    hoursRows,
    hasActiveCatalog,
    featuredServices,
    isOwnerPreview,
    logoUrl,
    coverUrl,
    nowMs,
  } = profile;
  const isUnpublishedPreview = isOwnerPreview && !settings.published_at;
  const publicUrl = publicBookingUrl(publicEnv.NEXT_PUBLIC_APP_URL, slug);
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
    // A <main> landmark, not a generic <div> — this is the primary content of the
    // page (there's no shell/nav around it to justify a plain div here), and axe
    // flagged its absence (landmark-one-main/region) when the a11y test was rerun for
    // the featured-services addition below.
    <main className="public-profile-page">
      {isUnpublishedPreview ? (
        <p className="public-preview-banner">
          Pré-visualização — esta página ainda não está publicada. As clientes não conseguem vê-la.
        </p>
      ) : null}
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
          <PublicShareButton businessName={tenant.name} url={publicUrl} />
        </div>

        {settings.about_description ? (
          <PublicAboutSection description={settings.about_description} />
        ) : null}

        <PublicFeaturedServices services={featuredServices} slug={slug} />

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
    </main>
  );
}
