import { Search } from 'lucide-react';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';
import { publicBookingUrl } from '@/features/onboarding/domain/publish-step';
import { CatalogSheetProvider } from '@/features/catalog/CatalogSheetContext';
import { CategoryChips, type CategoryFilter } from '@/features/catalog/CategoryChips';
import { ManageCategoriesButton } from '@/features/catalog/ManageCategoriesButton';
import { NewServiceHeaderButton } from '@/features/catalog/NewServiceHeaderButton';
import { OnlyActiveFilterButton } from '@/features/catalog/OnlyActiveFilterButton';
import { ServiceCard } from '@/features/catalog/ServiceCard';
import { PackageCard } from '@/features/catalog/PackageCard';
import { ServicesFab } from '@/features/catalog/ServicesFab';
import type { CategoryListItem } from '@/features/catalog/domain/category';
import type { ServiceListItem } from '@/features/catalog/domain/service';
import type { PackageListItem } from '@/features/catalog/domain/package';

function isCategoryFilter(value: string | undefined): CategoryFilter {
  return value ?? 'all';
}

// NEX-045-ish visual refinement mid-2026 — Serviços reference: "a lista serve para
// consultar e gerir rapidamente; os formulários pertencem a telas separadas." Every
// create/edit form that used to render inline (categories, service, photo, package)
// now opens in a shared bottom sheet (CatalogSheetProvider) instead — same
// architecture as the agenda completion sheet and the Clientes page this session.
//
// Deliberately simplified from the reference: the package editor is one scrolling
// sheet rather than a 4-step wizard, and category reordering keeps the existing
// swap-based up/down buttons rather than real drag-and-drop (no dnd library anywhere
// in this app yet — a new capability, not a restyle). Both are noted as scope
// decisions, not oversights.
export default async function ServicosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; onlyActive?: string }>;
}) {
  const { tenantId } = await requireProfile();
  const params = await searchParams;
  const query = (params.q ?? '').trim();
  const activeFilter: CategoryFilter = isCategoryFilter(params.category);
  const onlyActive = params.onlyActive === '1';

  const supabase = await createClient();

  const [
    { data: categoryRows },
    { data: serviceRows },
    { data: packageRows },
    { data: packageServiceRows },
    { data: tenantRow },
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
      .order('sort_order'),
    supabase
      .from('packages')
      .select('id, name, price_cents, compare_at_price_cents, is_active')
      .eq('tenant_id', tenantId)
      .order('created_at'),
    supabase.from('package_services').select('package_id, service_id').eq('tenant_id', tenantId),
    supabase.from('tenants').select('slug').eq('id', tenantId).single(),
  ]);

  const categories: CategoryListItem[] = (categoryRows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    isVisible: row.is_visible,
  }));
  const categoriesById = new Map(categories.map((category) => [category.id, category]));

  const allServices: ServiceListItem[] = (serviceRows ?? []).map((row) => ({
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
  const allPackages: PackageListItem[] = (packageRows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    priceCents: row.price_cents,
    compareAtPriceCents: row.compare_at_price_cents,
    isActive: row.is_active,
    serviceIds: serviceIdsByPackageId.get(row.id) ?? [],
  }));
  const servicesById = new Map(allServices.map((service) => [service.id, service]));

  const normalizedQuery = query.toLowerCase();
  const matchesQuery = (name: string) =>
    normalizedQuery === '' || name.toLowerCase().includes(normalizedQuery);

  const showingPackages = activeFilter === 'packages';

  const filteredServices = showingPackages
    ? []
    : allServices.filter(
        (service) =>
          matchesQuery(service.name) &&
          (activeFilter === 'all' || service.categoryId === activeFilter) &&
          (!onlyActive || service.isActive),
      );

  const filteredPackages = showingPackages
    ? allPackages.filter((pkg) => matchesQuery(pkg.name) && (!onlyActive || pkg.isActive))
    : [];

  const publicUrl = tenantRow?.slug
    ? `${publicBookingUrl(publicEnv.NEXT_PUBLIC_APP_URL, tenantRow.slug)}/servicos`
    : null;

  const hasNoCategories = categories.length === 0;
  const isEmptyTenant = allServices.length === 0;
  const isSearchingOrFiltering = query.length > 0 || onlyActive;
  const listIsEmpty = showingPackages
    ? filteredPackages.length === 0
    : filteredServices.length === 0;

  return (
    <div className="shell services-page">
      <CatalogSheetProvider categories={categories} services={allServices}>
        <header className="services-header">
          <h1 className="services-title">Serviços</h1>
          <NewServiceHeaderButton />
        </header>

        {publicUrl ? (
          <a href={publicUrl} target="_blank" rel="noreferrer" className="services-preview-link">
            Ver como a cliente vê
          </a>
        ) : null}

        <form method="get" className="services-search-row">
          <span className="services-search-wrapper">
            <Search aria-hidden="true" />
            {activeFilter !== 'all' ? (
              <input type="hidden" name="category" value={activeFilter} />
            ) : null}
            {onlyActive ? <input type="hidden" name="onlyActive" value="1" /> : null}
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Pesquisar serviços..."
              className="services-search"
              aria-label="Pesquisar serviços"
            />
          </span>
          <OnlyActiveFilterButton active={onlyActive} query={query} category={activeFilter} />
        </form>

        <CategoryChips categories={categories} activeFilter={activeFilter} query={query} />

        {hasNoCategories ? (
          <div className="services-empty-state">
            <p className="text-support">Crie primeiro uma categoria para poder criar serviços.</p>
            <ManageCategoriesButton label="Gerir categorias" />
          </div>
        ) : showingPackages && isEmptyTenant ? (
          <div className="services-empty-state">
            <p className="text-support">Crie primeiro um serviço para poder criar pacotes.</p>
            <NewServiceHeaderButton label="Criar serviço" />
          </div>
        ) : !showingPackages && isEmptyTenant ? (
          <div className="services-empty-state">
            <p className="text-support">Ainda não criou nenhum serviço.</p>
            <p className="text-support">
              Crie o primeiro serviço para começar a receber marcações.
            </p>
            <NewServiceHeaderButton label="Criar serviço" />
          </div>
        ) : listIsEmpty ? (
          <div className="services-empty-state">
            <p className="text-support">
              {showingPackages
                ? isSearchingOrFiltering
                  ? 'Nenhum pacote encontrado.'
                  : 'Ainda não criou nenhum pacote.'
                : query.length > 0
                  ? 'Nenhum serviço encontrado para esta pesquisa.'
                  : onlyActive
                    ? 'Nenhum serviço ativo nesta categoria.'
                    : 'Não existem serviços nesta categoria.'}
            </p>
            {!isSearchingOrFiltering ? (
              <NewServiceHeaderButton
                label={showingPackages ? 'Criar primeiro pacote' : 'Criar serviço'}
                asPackage={showingPackages}
              />
            ) : null}
          </div>
        ) : (
          <ul className="services-list">
            {showingPackages
              ? filteredPackages.map((pkg) => (
                  <PackageCard key={pkg.id} pkg={pkg} servicesById={servicesById} />
                ))
              : filteredServices.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    category={categoriesById.get(service.categoryId)}
                  />
                ))}
            <div id="services-list-end" aria-hidden="true" />
          </ul>
        )}

        <ServicesFab activeFilter={activeFilter} />
      </CatalogSheetProvider>
    </div>
  );
}
