import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { NewAppointmentWizard } from '@/features/appointments/wizard/NewAppointmentWizard';

// NEX-085: "Cliente, itens, slot, valor, observação" — server-loaded catalog, same
// tenant-scoped pattern as every other authenticated dashboard page (requireProfile() +
// RLS-enforced createClient()). Accepts an optional ?clientId= so "nova marcação para
// {cliente}" links (client detail page, completed-appointment "duplicar" action) can
// arrive with the client already selected instead of the owner re-picking them.
//
// Visual refinement mid-2026 (Nova marcação wizard): no longer preloads every client —
// ClientStep searches on demand (suggestExistingClients, NEX-092) instead of a <select>
// populated from the full list, so this only fetches the one client named by ?clientId=.
export default async function NewManualBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { tenantId } = await requireProfile();
  const { clientId } = await searchParams;
  const supabase = await createClient();

  const [
    { data: initialClientRow },
    { data: categoryRows },
    { data: serviceRows },
    { data: packageRows },
    { data: packageServiceRows },
    { data: settings },
  ] = await Promise.all([
    clientId
      ? supabase
          .from('clients')
          .select('id, name, phone_e164')
          .eq('tenant_id', tenantId)
          .eq('id', clientId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
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
    <div className="new-appointment-page">
      <NewAppointmentWizard
        categoryGroups={categoryGroups}
        packages={packageOptions}
        timezone={settings?.timezone ?? 'Europe/Lisbon'}
        initialClient={
          initialClientRow
            ? {
                id: initialClientRow.id,
                name: initialClientRow.name,
                phoneE164: initialClientRow.phone_e164,
              }
            : undefined
        }
      />
    </div>
  );
}
