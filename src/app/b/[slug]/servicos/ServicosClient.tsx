'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useBookingSession } from '../useBookingSession';
import {
  cartLines,
  cartTotals,
  dropServicesCoveredByPackage,
  type PackageOption,
  type ServiceLine,
} from '../domain/booking-selection';

type CategoryGroup = { id: string; name: string; services: ServiceLine[] };

function formatEuros(cents: number) {
  return (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

// Visual refinement mid-2026: step 1 of the paginated public flow
// (docs/UI_SCREEN_SPECIFICATIONS.md #04/#05) — services and packages are two tabs of the
// same step, not two separate pages, since a visitor commonly checks both before
// deciding; "Continuar" is the one action that actually advances.
export function ServicosClient({
  tenantId,
  tenantSlug,
  categoryGroups,
  packages,
}: {
  tenantId: string;
  tenantSlug: string;
  categoryGroups: CategoryGroup[];
  packages: PackageOption[];
}) {
  const router = useRouter();
  const { state, ready, persist } = useBookingSession(tenantId, tenantSlug);
  const [tab, setTab] = useState<'servicos' | 'pacotes'>('servicos');
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const [pending, setPending] = useState(false);
  const [continueError, setContinueError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  if (ready && !hydrated) {
    setHydrated(true);
    setSelectedPackageId(state.selectedPackageId);
    setSelectedServiceIds(new Set(state.selectedServiceIds));
  }

  const servicesById = useMemo(() => {
    const map = new Map<string, ServiceLine>();
    for (const group of categoryGroups) {
      for (const service of group.services) map.set(service.id, service);
    }
    return map;
  }, [categoryGroups]);

  const selectedPackage = packages.find((pkg) => pkg.id === selectedPackageId) ?? null;
  const coveredByPackage = new Set(selectedPackage?.serviceIds ?? []);

  function toggleService(id: string) {
    if (coveredByPackage.has(id)) return;
    setSelectedServiceIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectPackage(pkg: PackageOption | null) {
    setSelectedPackageId(pkg?.id ?? null);
    setSelectedServiceIds((current) => new Set(dropServicesCoveredByPackage([...current], pkg)));
  }

  const lines = cartLines(
    { selectedPackageId, selectedServiceIds: Array.from(selectedServiceIds) },
    servicesById,
    packages,
  );
  const { totalCents } = cartTotals(lines);

  const normalizedSearch = search.trim().toLowerCase();
  const visibleGroups = categoryGroups
    .filter((group) => !activeCategoryId || group.id === activeCategoryId)
    .map((group) => ({
      ...group,
      services: normalizedSearch
        ? group.services.filter((service) => service.name.toLowerCase().includes(normalizedSearch))
        : group.services,
    }))
    .filter((group) => group.services.length > 0);

  // A rejected persist() (e.g. a transient server error) must never leave "Continuar"
  // stuck mid-click forever with no feedback — the draft is how the next page finds out
  // what was selected, not just a nice-to-have, so a failed save has to be visible and
  // retryable rather than silently swallowed or navigated past with stale state.
  async function handleContinue() {
    setPending(true);
    setContinueError(null);
    try {
      const result = await persist({
        ...state,
        selectedPackageId,
        selectedServiceIds: Array.from(selectedServiceIds),
      });
      if (!result.ok) {
        setContinueError(result.error.message);
        setPending(false);
        return;
      }
      router.push(`/b/${tenantSlug}/horario`);
    } catch {
      setContinueError('Não foi possível continuar. Tente novamente.');
      setPending(false);
    }
  }

  return (
    <>
      <div className="public-booking-content">
        <header className="public-step-header">
          <Link href={`/b/${tenantSlug}`} className="nx-icon-button" aria-label="Voltar">
            <ArrowLeft aria-hidden="true" />
          </Link>
          <h1 className="text-title">{tab === 'servicos' ? 'Serviços' : 'Pacotes'}</h1>
        </header>

        <div
          role="tablist"
          aria-label="Serviços ou pacotes"
          className="nx-tabs nx-tabs-pill public-tabs"
        >
          <button
            type="button"
            role="tab"
            className="nx-tab"
            aria-selected={tab === 'servicos'}
            onClick={() => setTab('servicos')}
          >
            Serviços
          </button>
          <button
            type="button"
            role="tab"
            className="nx-tab"
            aria-selected={tab === 'pacotes'}
            onClick={() => setTab('pacotes')}
            disabled={packages.length === 0}
          >
            Pacotes
          </button>
        </div>

        {tab === 'servicos' ? (
          <>
            <label className="public-search">
              <Search className="public-search-icon" size={18} aria-hidden="true" />
              <span className="sr-only">Pesquisar serviços</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Pesquisar serviços"
              />
            </label>

            {categoryGroups.length > 1 ? (
              <div
                role="tablist"
                aria-label="Filtrar por categoria"
                className="nx-tabs nx-tabs-pill public-tabs"
              >
                <button
                  type="button"
                  role="tab"
                  className="nx-tab"
                  aria-selected={activeCategoryId === null}
                  onClick={() => setActiveCategoryId(null)}
                >
                  Todos
                </button>
                {categoryGroups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    role="tab"
                    className="nx-tab"
                    aria-selected={activeCategoryId === group.id}
                    onClick={() => setActiveCategoryId(group.id)}
                  >
                    {group.name}
                  </button>
                ))}
              </div>
            ) : null}

            {visibleGroups.map((group) => (
              <div key={group.id} className="card">
                <h2 className="text-subtitle">{group.name}</h2>
                <ul className="public-service-list">
                  {group.services.map((service) => {
                    const included = coveredByPackage.has(service.id);
                    return (
                      <li key={service.id} className="public-service-item">
                        <label className="public-service-choice">
                          <span className="public-service-photo" aria-hidden="true" />
                          <span className="public-service-info">
                            <span className="public-service-name">
                              {service.name}
                              {included ? (
                                <span className="public-service-included">
                                  {' '}
                                  · Incluído no pacote
                                </span>
                              ) : null}
                            </span>
                            <span className="public-service-meta">
                              {service.durationMinutes} min · {formatEuros(service.priceCents)}
                            </span>
                          </span>
                          <span className="public-check-circle">
                            <input
                              type="checkbox"
                              className="public-check-input"
                              checked={included || selectedServiceIds.has(service.id)}
                              disabled={included}
                              onChange={() => toggleService(service.id)}
                            />
                            <Check className="public-check-icon" size={14} aria-hidden="true" />
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {categoryGroups.length === 0 ? (
              <div className="card">
                <p className="text-support">Ainda não há serviços disponíveis.</p>
              </div>
            ) : null}
            {categoryGroups.length > 0 && visibleGroups.length === 0 ? (
              <div className="card">
                <p className="text-support">Nenhum serviço encontrado.</p>
              </div>
            ) : null}
          </>
        ) : (
          <div className="card">
            <ul className="public-service-list">
              <li className="public-service-item">
                <label className="public-service-choice">
                  <span className="public-service-photo" aria-hidden="true" />
                  <span className="public-service-info">
                    <span className="public-service-name">Nenhum pacote</span>
                  </span>
                  <span className="public-check-circle">
                    <input
                      type="radio"
                      className="public-check-input"
                      name="pacote"
                      checked={selectedPackageId === null}
                      onChange={() => selectPackage(null)}
                    />
                    <span className="public-check-dot" aria-hidden="true" />
                  </span>
                </label>
              </li>
              {packages.map((pkg) => (
                <li key={pkg.id} className="public-service-item">
                  <label className="public-service-choice">
                    <span className="public-service-photo" aria-hidden="true" />
                    <span className="public-service-info">
                      <span className="public-service-name">{pkg.name}</span>
                      <span className="public-service-meta">
                        {pkg.itemNames} · {pkg.durationMinutes} min · {formatEuros(pkg.priceCents)}
                      </span>
                    </span>
                    <span className="public-check-circle">
                      <input
                        type="radio"
                        className="public-check-input"
                        name="pacote"
                        checked={selectedPackageId === pkg.id}
                        onChange={() => selectPackage(pkg)}
                      />
                      <span className="public-check-dot" aria-hidden="true" />
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {packages.length === 0 ? (
              <p className="text-support">Sem pacotes disponíveis.</p>
            ) : null}
          </div>
        )}
      </div>

      {continueError ? (
        <p role="alert" className="form-error public-continue-error">
          {continueError}
        </p>
      ) : null}
      <div className="public-cart-bar">
        <span className="public-cart-bar-totals" role="status">
          <span className="public-cart-bar-label">
            Total {lines.length} {lines.length === 1 ? 'Serviço' : 'Serviços'}
          </span>
          <span className="public-cart-bar-price">{formatEuros(totalCents)}</span>
        </span>
        <Button
          type="button"
          disabled={lines.length === 0 || pending}
          onClick={() => void handleContinue()}
        >
          {pending ? 'A continuar…' : 'Continuar'}
        </Button>
      </div>
    </>
  );
}
