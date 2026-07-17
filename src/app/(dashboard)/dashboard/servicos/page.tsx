import { Card } from '@/components/ui/Card';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { CategoriesManager } from '@/features/catalog/CategoriesManager';
import type { CategoryListItem } from '@/features/catalog/domain/category';

export default async function ServicosPage() {
  const { tenantId } = await requireProfile();
  const supabase = await createClient();

  const { data: categoryRows } = await supabase
    .from('service_categories')
    .select('id, name, sort_order, is_visible')
    .eq('tenant_id', tenantId)
    .order('sort_order');

  const categories: CategoryListItem[] = (categoryRows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    isVisible: row.is_visible,
  }));

  return (
    <div className="shell">
      <p className="eyebrow">Serviços</p>
      <h1>Serviços</h1>
      <Card>
        <CategoriesManager categories={categories} />
      </Card>
    </div>
  );
}
