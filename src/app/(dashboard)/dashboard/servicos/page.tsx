import { Card } from '@/components/ui/Card';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { CategoriesManager } from '@/features/catalog/CategoriesManager';
import { ServicesManager } from '@/features/catalog/ServicesManager';
import { PackagesManager } from '@/features/catalog/PackagesManager';
import type { CategoryListItem } from '@/features/catalog/domain/category';
import type { ServiceListItem } from '@/features/catalog/domain/service';
import type { PackageListItem } from '@/features/catalog/domain/package';

export default async function ServicosPage() {
  const { tenantId } = await requireProfile();
  const supabase = await createClient();

  const [
    { data: categoryRows },
    { data: serviceRows },
    { data: packageRows },
    { data: packageServiceRows },
  ] = await Promise.all([
    supabase
      .from('service_categories')
      .select('id, name, sort_order, is_visible')
      .eq('tenant_id', tenantId)
      .order('sort_order'),
    supabase
      .from('services')
      .select('id, name, price_cents, duration_minutes, category_id, is_active, photo_path')
      .eq('tenant_id', tenantId)
      .order('created_at'),
    supabase
      .from('packages')
      .select('id, name, price_cents, compare_at_price_cents, is_active')
      .eq('tenant_id', tenantId)
      .order('created_at'),
    supabase.from('package_services').select('package_id, service_id').eq('tenant_id', tenantId),
  ]);

  const categories: CategoryListItem[] = (categoryRows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    isVisible: row.is_visible,
  }));

  const services: ServiceListItem[] = (serviceRows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    priceCents: row.price_cents,
    durationMinutes: row.duration_minutes,
    categoryId: row.category_id,
    isActive: row.is_active,
    photoUrl: row.photo_path
      ? supabase.storage.from('service-photos').getPublicUrl(row.photo_path).data.publicUrl
      : null,
  }));

  const serviceIdsByPackageId = new Map<string, string[]>();
  for (const row of packageServiceRows ?? []) {
    const current = serviceIdsByPackageId.get(row.package_id) ?? [];
    current.push(row.service_id);
    serviceIdsByPackageId.set(row.package_id, current);
  }

  const packages: PackageListItem[] = (packageRows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    priceCents: row.price_cents,
    compareAtPriceCents: row.compare_at_price_cents,
    isActive: row.is_active,
    serviceIds: serviceIdsByPackageId.get(row.id) ?? [],
  }));

  return (
    <div className="shell">
      <p className="text-eyebrow">Serviços</p>
      <h1 className="text-title">Serviços</h1>
      <Card>
        <CategoriesManager categories={categories} />
      </Card>
      <Card>
        <ServicesManager services={services} categories={categories} />
      </Card>
      <Card>
        <PackagesManager packages={packages} services={services} />
      </Card>
    </div>
  );
}
