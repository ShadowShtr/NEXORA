'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { createPackage, togglePackageActive, updatePackage } from '@/features/catalog/actions';
import {
  derivePackageDurationMinutes,
  type PackageListItem,
} from '@/features/catalog/domain/package';
import { PackageCart } from '@/features/catalog/PackageCart';
import type { ServiceListItem } from '@/features/catalog/domain/service';
import type { Result } from '@/lib/result';

function formatEuros(cents: number) {
  return (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

type PackageRowProps = {
  pkg: PackageListItem;
  services: ServiceListItem[];
  servicesById: Map<string, ServiceListItem>;
};

function PackageRow({ pkg, services, servicesById }: PackageRowProps) {
  const [updateState, updateFormAction, updatePending] = useActionState<
    Result<null> | null,
    FormData
  >(updatePackage, null);
  const [toggleState, toggleFormAction, togglePending] = useActionState<
    Result<null> | null,
    FormData
  >(togglePackageActive, null);

  const error = [updateState, toggleState].find((state) => state && !state.ok) as
    { ok: false; error: { message: string } } | undefined;
  const durationMinutes = derivePackageDurationMinutes(pkg.serviceIds, servicesById);

  return (
    <li className="catalog-row">
      <form className="stack catalog-service-form" action={updateFormAction}>
        <input type="hidden" name="id" value={pkg.id} />
        <label>
          Nome do pacote
          <input name="name" defaultValue={pkg.name} maxLength={120} required />
        </label>
        <label>
          Preço (€)
          <input
            name="priceEuros"
            type="text"
            inputMode="decimal"
            defaultValue={(pkg.priceCents / 100).toFixed(2).replace('.', ',')}
            required
          />
        </label>
        <PackageCart services={services} initialServiceIds={pkg.serviceIds} />
        <Button type="submit" disabled={updatePending}>
          Guardar
        </Button>
      </form>

      <div className="catalog-row-actions">
        <form action={toggleFormAction}>
          <input type="hidden" name="id" value={pkg.id} />
          <Button type="submit" disabled={togglePending}>
            {pkg.isActive ? 'Desativar' : 'Ativar'}
          </Button>
        </form>
        <p className="catalog-service-summary">
          {formatEuros(pkg.priceCents)} · {durationMinutes} min (duração somada dos serviços)
        </p>
      </div>

      {!pkg.isActive ? <p className="catalog-hidden-badge">Inativo — não é oferecido</p> : null}
      {error ? (
        <p role="alert" className="form-error">
          {error.error.message}
        </p>
      ) : null}
    </li>
  );
}

export function PackagesManager({
  packages,
  services,
}: {
  packages: PackageListItem[];
  services: ServiceListItem[];
}) {
  const [createState, createFormAction, createPending] = useActionState<
    Result<null> | null,
    FormData
  >(createPackage, null);
  const servicesById = new Map(services.map((service) => [service.id, service]));

  // PackageCart keeps its own client-side state (the cart), which a successful form
  // submission does not otherwise clear — remount it with a fresh key so the next new
  // package starts from an empty cart instead of the previous one's selection.
  // Adjusting state during render (not in an effect) on a change of `createState` is
  // the pattern React recommends for this exact "reset on prop change" case.
  const [cartResetKey, setCartResetKey] = useState(0);
  const [lastCreateState, setLastCreateState] = useState(createState);
  if (createState !== lastCreateState) {
    setLastCreateState(createState);
    if (createState?.ok) setCartResetKey((key) => key + 1);
  }

  return (
    <section className="stack" aria-label="Pacotes">
      <h2>Pacotes</h2>
      {services.length === 0 ? (
        <p>Crie primeiro um serviço para poder montar pacotes.</p>
      ) : (
        <>
          {packages.length === 0 ? (
            <p>Ainda não tem pacotes.</p>
          ) : (
            <ul className="catalog-list">
              {packages.map((pkg) => (
                <PackageRow
                  key={pkg.id}
                  pkg={pkg}
                  services={services}
                  servicesById={servicesById}
                />
              ))}
            </ul>
          )}

          <form className="stack" aria-label="Novo pacote" action={createFormAction}>
            <label>
              Nome do pacote
              <input name="name" required maxLength={120} placeholder="Mãos e pés" />
            </label>
            <label>
              Preço (€)
              <input
                name="priceEuros"
                type="text"
                inputMode="decimal"
                required
                placeholder="45,00"
              />
            </label>
            <PackageCart key={cartResetKey} services={services} initialServiceIds={[]} />
            {createState && !createState.ok ? (
              <p role="alert" className="form-error">
                {createState.error.message}
              </p>
            ) : null}
            <Button type="submit" disabled={createPending}>
              {createPending ? 'A criar…' : 'Criar pacote'}
            </Button>
          </form>
        </>
      )}
    </section>
  );
}
