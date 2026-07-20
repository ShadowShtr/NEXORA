'use client';

import { useActionState, useState } from 'react';
import { Scissors } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { createService, toggleServiceActive, updateService } from '@/features/catalog/actions';
import { removeServicePhoto, uploadServicePhoto } from '@/features/catalog/photo-actions';
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

// Menu-style thumbnail shown on the public booking page (/b/[slug]/servicos) — one
// photo per service, uploading replaces whatever was there before rather than adding to
// a gallery (docs/01_PRODUCT_REQUIREMENTS.md #10's client-photos portfolio ban does not
// apply here: this is the service's own catalog photo, meant to be public, same as its
// name and price).
function ServicePhotoField({ service }: { service: ServiceListItem }) {
  const [uploadState, uploadFormAction, uploadPending] = useActionState<
    Result<null> | null,
    FormData
  >(uploadServicePhoto, null);
  const [removeState, removeFormAction, removePending] = useActionState<
    Result<null> | null,
    FormData
  >(removeServicePhoto, null);

  // Reset the file input after a successful upload — same "remount with a fresh key on
  // success" pattern as ClientPhotosForm, so the field doesn't keep showing the filename
  // of a photo that's already been sent.
  const [formKey, setFormKey] = useState(0);
  const [lastUploadState, setLastUploadState] = useState(uploadState);
  if (uploadState !== lastUploadState) {
    setLastUploadState(uploadState);
    if (uploadState?.ok) setFormKey((key) => key + 1);
  }

  const error = [uploadState, removeState].find((state) => state && !state.ok) as
    { ok: false; error: { message: string } } | undefined;

  return (
    <div className="catalog-service-photo">
      {service.photoUrl ? (
        // Public bucket URL, not an asset next/image needs to sign or refresh.
        // eslint-disable-next-line @next/next/no-img-element
        <img className="catalog-service-photo-thumb" src={service.photoUrl} alt="" />
      ) : (
        <div
          className="catalog-service-photo-thumb catalog-service-photo-placeholder"
          aria-hidden="true"
        />
      )}
      <form key={formKey} action={uploadFormAction} className="catalog-service-photo-form">
        <input type="hidden" name="serviceId" value={service.id} />
        <label>
          Fotografia
          <input type="file" name="file" accept="image/jpeg,image/png,image/webp" required />
        </label>
        <Button type="submit" variant="secondary" disabled={uploadPending}>
          {uploadPending ? 'A enviar…' : service.photoUrl ? 'Substituir foto' : 'Adicionar foto'}
        </Button>
      </form>
      {service.photoUrl ? (
        <form action={removeFormAction}>
          <input type="hidden" name="serviceId" value={service.id} />
          <Button type="submit" variant="secondary" disabled={removePending}>
            {removePending ? 'A remover…' : 'Remover foto'}
          </Button>
        </form>
      ) : null}
      {error ? (
        <p role="alert" className="form-error">
          {error.error.message}
        </p>
      ) : null}
    </div>
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

      <ServicePhotoField service={service} />

      <div className="catalog-row-actions">
        <form action={toggleFormAction}>
          <input type="hidden" name="id" value={service.id} />
          <Button type="submit" variant="secondary" disabled={togglePending}>
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
      <h2 className="catalog-section-title">
        <Scissors aria-hidden="true" size={22} />
        Serviços
      </h2>
      {categories.length === 0 ? (
        <p className="catalog-empty">Crie primeiro uma categoria para poder adicionar serviços.</p>
      ) : (
        <>
          {services.length === 0 ? (
            <p className="catalog-empty">Ainda não tem serviços.</p>
          ) : (
            <ul className="catalog-list">
              {services.map((service) => (
                <ServiceRow key={service.id} service={service} categories={categories} />
              ))}
            </ul>
          )}

          <form
            className="stack catalog-add-form"
            aria-label="Novo serviço"
            action={createFormAction}
          >
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
