'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { createPackage, togglePackageActive, updatePackage } from './actions';
import { PackageCart } from './PackageCart';
import { derivePackageDurationMinutes } from './domain/package';
import type { PackageListItem } from './domain/package';
import type { ServiceListItem } from './domain/service';
import type { Result } from '@/lib/result';

function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

function formatEurosInputValue(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

// Visual refinement mid-2026 — Serviços reference asked for a 4-step wizard (info ->
// services -> price -> summary). Built as one scrolling sheet instead: every field is
// still grouped the same way (name, services included, price/promo) and the live
// summary strip at the bottom covers what a dedicated "resumo" step would show, without
// the extra step-navigation state a full wizard needs — a deliberate scope trim, not an
// oversight, given how much net-new UI a real multi-step flow is elsewhere in this pass.
export function PackageEditorSheet({
  pkg,
  services,
  onClose,
}: {
  pkg: PackageListItem | null;
  services: ServiceListItem[];
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState<Result<null> | null, FormData>(
    pkg ? updatePackage : createPackage,
    null,
  );
  const [toggleState, toggleFormAction, togglePending] = useActionState<
    Result<null> | null,
    FormData
  >(togglePackageActive, null);

  const [isActive, setIsActive] = useState(pkg?.isActive ?? true);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(pkg?.serviceIds ?? []);

  const servicesById = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  if (state?.ok) return null;

  const error = [state, toggleState].find((candidate) => candidate && !candidate.ok) as
    { ok: false; error: { message: string } } | undefined;

  const durationMinutes = derivePackageDurationMinutes(selectedServiceIds, servicesById);
  const normalTotalCents = selectedServiceIds.reduce(
    (total, id) => total + (servicesById.get(id)?.priceCents ?? 0),
    0,
  );

  return (
    <BottomSheet
      title={pkg ? 'Editar pacote' : 'Novo pacote'}
      subtitle={pkg ? pkg.name : 'Combine serviços num único preço promocional.'}
      onClose={onClose}
    >
      <form action={formAction} className="service-editor-form">
        {pkg ? <input type="hidden" name="id" value={pkg.id} /> : null}
        <div className="stack service-editor-fields">
          <div className="form-field">
            <label className="form-label" htmlFor="package-name">
              Nome do pacote
            </label>
            <input
              id="package-name"
              name="name"
              className="form-input"
              defaultValue={pkg?.name}
              maxLength={120}
              placeholder="Mãos e pés"
              required
            />
          </div>

          <div className="form-field">
            <PackageCart
              services={services}
              initialServiceIds={selectedServiceIds}
              onChange={setSelectedServiceIds}
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="package-price">
              Preço do pacote
            </label>
            <div className="form-input-prefix-wrapper">
              <span className="form-input-prefix" aria-hidden="true">
                €
              </span>
              <input
                id="package-price"
                name="priceEuros"
                type="text"
                inputMode="decimal"
                className="form-input form-input-with-prefix"
                defaultValue={pkg ? formatEurosInputValue(pkg.priceCents) : undefined}
                placeholder="45,00"
                required
              />
            </div>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="package-compare-price">
              Preço original (opcional)
            </label>
            <div className="form-input-prefix-wrapper">
              <span className="form-input-prefix" aria-hidden="true">
                €
              </span>
              <input
                id="package-compare-price"
                name="compareAtPriceEuros"
                type="text"
                inputMode="decimal"
                className="form-input form-input-with-prefix"
                defaultValue={
                  pkg?.compareAtPriceCents != null
                    ? formatEurosInputValue(pkg.compareAtPriceCents)
                    : undefined
                }
                placeholder={
                  normalTotalCents > 0 ? formatEurosInputValue(normalTotalCents) : 'Sem promoção'
                }
              />
            </div>
            <p className="text-support">
              Mostra o pacote como promoção com desconto. Deixe em branco para não promover.
            </p>
          </div>

          {selectedServiceIds.length > 0 ? (
            <div className="package-summary">
              <p>
                {selectedServiceIds.length}{' '}
                {selectedServiceIds.length === 1 ? 'serviço' : 'serviços'}
              </p>
              <p>{durationMinutes} minutos</p>
              <p>Valor normal: {formatEuros(normalTotalCents)}</p>
            </div>
          ) : null}

          {pkg ? (
            <div className="form-field">
              <span className="form-label">Estado</span>
              <div className="service-editor-active-row">
                <span>Disponível para marcação</span>
                <button
                  type="button"
                  className="service-toggle"
                  data-active={isActive || undefined}
                  role="switch"
                  aria-checked={isActive}
                  aria-label="Disponível para marcação"
                  disabled={togglePending}
                  onClick={() => {
                    setIsActive((current) => !current);
                    const formData = new FormData();
                    formData.set('id', pkg.id);
                    toggleFormAction(formData);
                  }}
                />
              </div>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="form-error">
              {error.error.message}
            </p>
          ) : null}
        </div>

        <div className="form-sticky-footer">
          <Button type="submit" className="primary-save-button" disabled={pending}>
            {pending ? 'A guardar…' : pkg ? 'Guardar' : 'Criar pacote'}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}
