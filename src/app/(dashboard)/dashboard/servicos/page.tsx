import { Card } from '@/components/ui/Card';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { CategoriesManager } from '@/features/catalog/CategoriesManager';
import { ServicesManager } from '@/features/catalog/ServicesManager';
import type { CategoryListItem } from '@/features/catalog/domain/category';
import type { ServiceListItem } from '@/features/catalog/domain/service';

export default async function ServicosPage() {
  const { tenantId } = await requireProfile();
  const supabase = await createClient();

  const [{ data: categoryRows }, { data: serviceRows }] = await Promise.all([
    supabase
      .from('service_categories')
      .select('id, name, sort_order, is_visible')
      .eq('tenant_id', tenantId)
      .order('sort_order'),
    supabase
      .from('services')
      .select('id, name, price_cents, duration_minutes, category_id, is_active')
      .eq('tenant_id', tenantId)
      .order('created_at'),
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
  }));

  return (
    <div className="shell">
      <p className="eyebrow">Serviços</p>
      <h1>Serviços</h1>
      <Card>
        <CategoriesManager categories={categories} />
      </Card>
      <Card>
        <ServicesManager services={services} categories={categories} />
      </Card>
    </div>
  );
}
