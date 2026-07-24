import { Card } from '@/components/ui/Card';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { ManualBookingForm } from '@/features/appointments/ManualBookingForm';

// NEX-085: "Cliente, itens, slot, valor, observação" — server-loaded catalog/client
// list, same tenant-scoped pattern as every other authenticated dashboard page
// (requireProfile() + RLS-enforced createClient()). Accepts an optional ?clientId= so
// "nova marcação para {cliente}" links (client detail page, completed-appointment
// "duplicar" action) can arrive with the client already selected instead of the owner
// re-picking them from the list.
export default async function NewManualBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { tenantId } = await requireProfile();
  const { clientId } = await searchParams;
  const supabase = await createClient();

  const [
    { data: clientRows },
    { data: categoryRows },
    { data: serviceRows },
    { data: packageRows },
    { data: packageServiceRows },
    { data: settings },
  ] = await Promise.all([
    supabase.from('clients').select('id, name, phone_e164').eq('tenant_id', tenantId).order('name'),
    supabase
      .from('service_categories')
      .select('id, name, sort_order')
      .eq('tenant_id', tenantId)
      .order('sort_order'),
    supabase
      .from('services')
      .select('id, name, price_cents, duration_minutes, category_id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('packages')
      .select('id, name, price_cents')
      .eq('tenant_id', tenantId)
      .eq('is_active', true),
    supabase.from('package_services').select('package_id, service_id').eq('tenant_id', tenantId),
    supabase.from('business_settings').select('timezone').eq('tenant_id', tenantId).maybeSingle(),
  ]);

  const services = serviceRows ?? [];
  const servicesById = new Map(services.map((service) => [service.id, service]));
  const serviceIdsByPackageId = new Map<string, string[]>();
  for (const row of packageServiceRows ?? []) {
    const list = serviceIdsByPackageId.get(row.package_id) ?? [];
    list.push(row.service_id);
    serviceIdsByPackageId.set(row.package_id, list);
  }

  const categoryGroups = (categoryRows ?? [])
    .map((category) => ({
      id: category.id,
      name: category.name,
      services: services
        .filter((service) => service.category_id === category.id)
        .map((service) => ({
          id: service.id,
          name: service.name,
          priceCents: service.price_cents,
          durationMinutes: service.duration_minutes,
          photoUrl: null,
        })),
    }))
    .filter((group) => group.services.length > 0);

  const packageOptions = (packageRows ?? []).map((pkg) => {
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

  return (
    <div className="shell">
      <p className="text-eyebrow">Agenda</p>
      <h1 className="text-title">Nova marcação</h1>
      <Card>
        <ManualBookingForm
          clients={(clientRows ?? []).map((client) => ({
            id: client.id,
            name: client.name,
            phoneE164: client.phone_e164,
          }))}
          categoryGroups={categoryGroups}
          packages={packageOptions}
          timezone={settings?.timezone ?? 'Europe/Lisbon'}
          initialClientId={clientId}
        />
      </Card>
    </div>
  );
}
