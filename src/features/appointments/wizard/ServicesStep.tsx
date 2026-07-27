'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import {
  cartLines,
  cartTotals,
  dropServicesCoveredByPackage,
  type PackageOption,
  type ServiceLine,
} from '@/app/b/[slug]/domain/booking-selection';
import { formatDurationLabel, formatEuros } from '../domain/appointment-wizard';

export type CategoryGroup = { id: string; name: string; services: ServiceLine[] };

function SelectionCircle({ selected }: { selected: boolean }) {
  return (
    <span
      className="service-selection-circle"
      data-selected={selected || undefined}
      aria-hidden="true"
    >
      {selected ? '✓' : null}
    </span>
  );
}

// Step 2 — "O que será realizado?" Reuses the exact cart domain functions the public
// booking flow already relies on (cartLines/cartTotals/dropServicesCoveredByPackage,
// booking-selection.ts) so a package-with-extras never drifts from how the public page
// computes the same thing — only the presentation (tabs + category chips + selectable
// cards instead of a public cart bar) is new here.
export function ServicesStep({
  categoryGroups,
  packages,
  selectedPackageId,
  selectedServiceIds,
  onToggleService,
  onSelectPackage,
}: {
  categoryGroups: CategoryGroup[];
  packages: PackageOption[];
  selectedPackageId: string | null;
  selectedServiceIds: Set<string>;
  onToggleService: (id: string) => void;
  onSelectPackage: (pkg: PackageOption | null) => void;
}) {
  const [tab, setTab] = useState<'services' | 'packages'>('services');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | string>('all');

  const servicesById = useMemo(() => {
    const map = new Map<string, ServiceLine>();
    for (const group of categoryGroups)
      for (const service of group.services) map.set(service.id, service);
    return map;
  }, [categoryGroups]);

  const coveredByPackage = new Set(
    packages.find((pkg) => pkg.id === selectedPackageId)?.serviceIds ?? [],
  );

  const lines = cartLines(
    { selectedPackageId, selectedServiceIds: Array.from(selectedServiceIds) },
    servicesById,
    packages,
  );
  const { totalCents, totalMinutes } = cartTotals(lines);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleGroups = categoryGroups
    .filter((group) => categoryFilter === 'all' || categoryFilter === group.id)
    .map((group) => ({
      ...group,
      services: group.services.filter((service) =>
        normalizedQuery ? service.name.toLowerCase().includes(normalizedQuery) : true,
      ),
    }))
    .filter((group) => group.services.length > 0);

  const visiblePackages = packages.filter((pkg) =>
    normalizedQuery ? pkg.name.toLowerCase().includes(normalizedQuery) : true,
  );

  function handleTogglePackage(pkg: PackageOption) {
    if (selectedPackageId === pkg.id) {
      onSelectPackage(null);
      return;
    }
    onSelectPackage(pkg);
  }

  return (
    <div className="step-heading">
      <h2 className="step-title">O que será realizado?</h2>
      <p className="step-description">Selecione um ou mais serviços ou escolha um pacote.</p>

      <div className="service-type-tabs">
        <button
          type="button"
          className="service-type-tab"
          data-active={tab === 'services' || undefined}
          onClick={() => setTab('services')}
        >
          Serviços
        </button>
        <button
          type="button"
          className="service-type-tab"
          data-active={tab === 'packages' || undefined}
          disabled={packages.length === 0}
          onClick={() => setTab('packages')}
        >
          Pacotes
        </button>
      </div>

      <div className="client-search-wrapper appointment-service-search">
        <Search className="client-search-icon" aria-hidden="true" size={18} />
        <input
          type="text"
          className="client-search-input"
          placeholder={tab === 'services' ? 'Pesquisar serviço' : 'Pesquisar pacote'}
          aria-label={tab === 'services' ? 'Pesquisar serviço' : 'Pesquisar pacote'}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {tab === 'services' ? (
        <>
          <div className="service-category-chip-row">
            <button
              type="button"
              className="service-category-chip"
              data-active={categoryFilter === 'all' || undefined}
              onClick={() => setCategoryFilter('all')}
            >
              Todos
            </button>
            {categoryGroups.map((group) => (
              <button
                key={group.id}
                type="button"
                className="service-category-chip"
                data-active={categoryFilter === group.id || undefined}
                onClick={() => setCategoryFilter(group.id)}
              >
                {group.name}
              </button>
            ))}
          </div>

          {visibleGroups.length === 0 ? (
            <p className="text-support appointment-service-empty">
              {normalizedQuery ? 'Nenhum serviço encontrado.' : 'Sem serviços nesta categoria.'}
            </p>
          ) : (
            visibleGroups.map((group) => (
              <div key={group.id} className="appointment-service-group">
                <p className="text-eyebrow">{group.name}</p>
                <ul className="appointment-service-card-list">
                  {group.services.map((service) => {
                    const included = coveredByPackage.has(service.id);
                    const selected = included || selectedServiceIds.has(service.id);
                    return (
                      <li key={service.id}>
                        <button
                          type="button"
                          className="appointment-service-card"
                          data-selected={selected || undefined}
                          disabled={included}
                          onClick={() => onToggleService(service.id)}
                          aria-pressed={selected}
                        >
                          <span className="appointment-service-card-main">
                            <span className="appointment-service-card-name">{service.name}</span>
                            <span className="appointment-service-card-meta">
                              {service.durationMinutes} min · {formatEuros(service.priceCents)}
                              {included ? ' · incluído no pacote' : ''}
                            </span>
                          </span>
                          <SelectionCircle selected={selected} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </>
      ) : (
        <ul className="appointment-service-card-list">
          {visiblePackages.map((pkg) => {
            const selected = selectedPackageId === pkg.id;
            return (
              <li key={pkg.id}>
                <button
                  type="button"
                  className="appointment-service-card"
                  data-selected={selected || undefined}
                  onClick={() => handleTogglePackage(pkg)}
                  aria-pressed={selected}
                >
                  <span className="appointment-service-card-main">
                    <span className="appointment-service-card-name">{pkg.name}</span>
                    <span className="appointment-service-card-meta">
                      {pkg.itemNames} · {formatEuros(pkg.priceCents)}
                    </span>
                  </span>
                  <SelectionCircle selected={selected} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {lines.length > 0 ? (
        <div className="selected-services-summary">
          <span>
            {lines.length === 1 ? '1 serviço' : `${lines.length} serviços`} ·{' '}
            {formatDurationLabel(totalMinutes)}
          </span>
          <span className="selected-services-summary-total">{formatEuros(totalCents)}</span>
        </div>
      ) : null}
    </div>
  );
}

export function dropCoveredServices(
  selectedServiceIds: Set<string>,
  pkg: PackageOption | null,
): Set<string> {
  return new Set(dropServicesCoveredByPackage([...selectedServiceIds], pkg));
}
