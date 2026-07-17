import { notFound } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { createClient } from '@/lib/supabase/server';
import { PublicBookingCart } from './PublicBookingCart';

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

  const [
    { data: settings },
    { data: categoryRows },
    { data: serviceRows },
    { data: packageRows },
    { data: packageServiceRows },
  ] = await Promise.all([
    supabase
      .from('business_settings')
      .select('professional_name, phone_e164, address_line, postal_code, locality, maps_url')
      .eq('tenant_id', tenant.id)
      .maybeSingle(),
    supabase
      .from('service_categories')
      .select('id, name, sort_order')
      .eq('tenant_id', tenant.id)
      .order('sort_order'),
    supabase
      .from('services')
      .select('id, name, price_cents, duration_minutes, category_id, sort_order')
      .eq('tenant_id', tenant.id)
      .order('sort_order'),
    supabase.from('packages').select('id, name, price_cents').eq('tenant_id', tenant.id),
    supabase.from('package_services').select('package_id, service_id').eq('tenant_id', tenant.id),
  ]);

  // No `published_at` (business_settings) means the public policies (status='active',
  // published_at is not null) never matched in the first place — settings will be null.
  if (!settings) notFound();

  const categories = categoryRows ?? [];
  const services = serviceRows ?? [];
  const packages = packageRows ?? [];
  const servicesByCategory = new Map<string, typeof services>();
  for (const service of services) {
    const list = servicesByCategory.get(service.category_id) ?? [];
    list.push(service);
    servicesByCategory.set(service.category_id, list);
  }

  const servicesById = new Map(services.map((service) => [service.id, service]));
  const serviceIdsByPackageId = new Map<string, string[]>();
  for (const row of packageServiceRows ?? []) {
    const list = serviceIdsByPackageId.get(row.package_id) ?? [];
    list.push(row.service_id);
    serviceIdsByPackageId.set(row.package_id, list);
  }

  const categoryGroups = categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      services: (servicesByCategory.get(category.id) ?? []).map((service) => ({
        id: service.id,
        name: service.name,
        priceCents: service.price_cents,
        durationMinutes: service.duration_minutes,
      })),
    }))
    .filter((group) => group.services.length > 0);

  const packageOptions = packages.map((pkg) => {
    const items = (serviceIdsByPackageId.get(pkg.id) ?? [])
      .map((serviceId) => servicesById.get(serviceId))
      .filter((service) => service !== undefined);
    return {
      id: pkg.id,
      name: pkg.name,
      priceCents: pkg.price_cents,
      durationMinutes: items.reduce((total, service) => total + service.duration_minutes, 0),
      itemNames: items.map((service) => service.name).join(' + '),
    };
  });

  return (
    <main className="shell stack">
      <Card className="public-header">
        <p className="eyebrow">{tenant.name}</p>
        <h1>{settings.professional_name}</h1>
        <p className="public-address">
          {settings.address_line}, {settings.postal_code} {settings.locality}
        </p>
        <div className="public-cta">
          {settings.phone_e164 ? (
            <a className="button link-button" href={whatsappLink(settings.phone_e164, tenant.name)}>
              Marcar por WhatsApp
            </a>
          ) : null}
          {settings.phone_e164 ? (
            <a className="button link-button" href={`tel:${settings.phone_e164}`}>
              Ligar agora
            </a>
          ) : null}
          {settings.maps_url ? (
            <a
              className="button link-button"
              href={settings.maps_url}
              target="_blank"
              rel="noreferrer"
            >
              Ver no mapa
            </a>
          ) : null}
        </div>
      </Card>

      <PublicBookingCart
        businessName={tenant.name}
        phoneE164={settings.phone_e164}
        categoryGroups={categoryGroups}
        packages={packageOptions}
      />
    </main>
  );
}
