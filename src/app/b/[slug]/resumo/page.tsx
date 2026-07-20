import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resolveLocationUrl } from '@/lib/open-location';
import { ResumoClient } from './ResumoClient';

export default async function ResumoPage({ params }: { params: Promise<{ slug: string }> }) {
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
  if (!settings) notFound();

  const [{ data: serviceRows }, { data: packageRows }, { data: packageServiceRows }] =
    await Promise.all([
      supabase
        .from('services')
        .select('id, name, price_cents, duration_minutes')
        .eq('tenant_id', tenant.id),
      supabase.from('packages').select('id, name, price_cents').eq('tenant_id', tenant.id),
      supabase.from('package_services').select('package_id, service_id').eq('tenant_id', tenant.id),
    ]);

  const services = serviceRows ?? [];
  const servicesById = new Map(services.map((service) => [service.id, service]));
  const serviceIdsByPackageId = new Map<string, string[]>();
  for (const row of packageServiceRows ?? []) {
    const list = serviceIdsByPackageId.get(row.package_id) ?? [];
    list.push(row.service_id);
    serviceIdsByPackageId.set(row.package_id, list);
  }

  const packages = (packageRows ?? []).map((pkg) => {
    const items = (serviceIdsByPackageId.get(pkg.id) ?? [])
      .map((serviceId) => servicesById.get(serviceId))
      .filter((service) => service !== undefined);
    return {
      id: pkg.id,
      name: pkg.name,
      priceCents: pkg.price_cents,
      compareAtPriceCents: null,
      durationMinutes: items.reduce((total, service) => total + service.duration_minutes, 0),
      itemNames: items.map((service) => service.name).join(' + '),
      serviceIds: items.map((service) => service.id),
      photoUrl: null,
    };
  });

  const locationUrl = resolveLocationUrl(settings.maps_url, {
    addressLine: settings.address_line,
    postalCode: settings.postal_code,
    locality: settings.locality,
  });

  return (
    <ResumoClient
      tenantId={tenant.id}
      tenantSlug={slug}
      businessName={tenant.name}
      professionalName={settings.professional_name}
      phoneE164={settings.phone_e164}
      timezone={settings.timezone}
      locationUrl={locationUrl}
      services={services.map((service) => ({
        id: service.id,
        name: service.name,
        priceCents: service.price_cents,
        durationMinutes: service.duration_minutes,
        photoUrl: null,
      }))}
      packages={packages}
    />
  );
}
