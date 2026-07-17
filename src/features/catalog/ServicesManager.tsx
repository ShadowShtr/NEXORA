'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { createService, toggleServiceActive, updateService } from '@/features/catalog/actions';
import type { CategoryListItem } from '@/features/catalog/domain/category';
import type { ServiceListItem } from '@/features/catalog/domain/service';
import type { Result } from '@/lib/result';

function formatEuros(cents: number) {
  return (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

function CategorySelect({
  name,
  categories,
  defaultValue,
}: {
  name: string;
  categories: CategoryListItem[];
  defaultValue?: string;
}) {
  return (
    <select name={name} defaultValue={defaultValue} required>
      {categories.map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
          {category.isVisible ? '' : ' (oculta)'}
        </option>
      ))}
    </select>
  );
}

type ServiceRowProps = {
  service: ServiceListItem;
  categories: CategoryListItem[];
};

function ServiceRow({ service, categories }: ServiceRowProps) {
  const [updateState, updateFormAction, updatePending] = useActionState<
    Result<null> | null,
    FormData
  >(updateService, null);
  const [toggleState, toggleFormAction, togglePending] = useActionState<
    Result<null> | null,
    FormData
  >(toggleServiceActive, null);

  const error = [updateState, toggleState].find((state) => state && !state.ok) as
    { ok: false; error: { message: string } } | undefined;

  return (
    <li className="catalog-row">
      <form className="stack catalog-service-form" action={updateFormAction}>
        <input type="hidden" name="id" value={service.id} />
        <label>
          Nome do serviço
          <input name="name" defaultValue={service.name} maxLength={120} required />
        </label>
        <label>
          Preço (€)
          <input
            name="priceEuros"
            type="text"
            inputMode="decimal"
            defaultValue={(service.priceCents / 100).toFixed(2).replace('.', ',')}
            required
          />
        </label>
        <label>
          Duração (minutos)
          <input
            name="durationMinutes"
            type="number"
            min={5}
            max={720}
            step={5}
            defaultValue={service.durationMinutes}
            required
          />
        </label>
        <label>
          Categoria
          <CategorySelect
            name="categoryId"
            categories={categories}
            defaultValue={service.categoryId}
          />
        </label>
        <Button type="submit" disabled={updatePending}>
          Guardar
        </Button>
      </form>

      <div className="catalog-row-actions">
        <form action={toggleFormAction}>
          <input type="hidden" name="id" value={service.id} />
          <Button type="submit" disabled={togglePending}>
            {service.isActive ? 'Desativar' : 'Ativar'}
          </Button>
        </form>
        <p className="catalog-service-summary">
          {formatEuros(service.priceCents)} · {service.durationMinutes} min
        </p>
      </div>

      {!service.isActive ? <p className="catalog-hidden-badge">Inativo — não é oferecido</p> : null}
      {error ? (
        <p role="alert" className="form-error">
          {error.error.message}
        </p>
      ) : null}
    </li>
  );
}

export function ServicesManager({
  services,
  categories,
}: {
  services: ServiceListItem[];
  categories: CategoryListItem[];
}) {
  const [createState, createFormAction, createPending] = useActionState<
    Result<null> | null,
    FormData
  >(createService, null);

  return (
    <section className="stack" aria-label="Serviços">
      <h2>Serviços</h2>
      {categories.length === 0 ? (
        <p>Crie primeiro uma categoria para poder adicionar serviços.</p>
      ) : (
        <>
          {services.length === 0 ? (
            <p>Ainda não tem serviços.</p>
          ) : (
            <ul className="catalog-list">
              {services.map((service) => (
                <ServiceRow key={service.id} service={service} categories={categories} />
              ))}
            </ul>
          )}

          <form className="stack" aria-label="Novo serviço" action={createFormAction}>
            <label>
              Nome do serviço
              <input name="name" required maxLength={120} placeholder="Verniz gel" />
            </label>
            <label>
              Preço (€)
              <input
                name="priceEuros"
                type="text"
                inputMode="decimal"
                required
                placeholder="25,00"
              />
            </label>
            <label>
              Duração (minutos)
              <input
                name="durationMinutes"
                type="number"
                min={5}
                max={720}
                step={5}
                required
                defaultValue={60}
              />
            </label>
            <label>
              Categoria
              <CategorySelect name="categoryId" categories={categories} />
            </label>
            {createState && !createState.ok ? (
              <p role="alert" className="form-error">
                {createState.error.message}
              </p>
            ) : null}
            <Button type="submit" disabled={createPending}>
              {createPending ? 'A criar…' : 'Criar serviço'}
            </Button>
          </form>
        </>
      )}
    </section>
  );
}
