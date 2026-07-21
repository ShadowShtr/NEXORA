'use client';

import { useActionState, useEffect, useState } from 'react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { createService, toggleServiceActive, updateService } from './actions';
import { ServicePhotoUpload } from './ServicePhotoUpload';
import type { CategoryListItem } from './domain/category';
import type { ServiceListItem } from './domain/service';
import type { Result } from '@/lib/result';

const DURATION_PRESETS = [15, 30, 45, 60, 90];

function formatEurosInputValue(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

// Visual refinement mid-2026 — Serviços reference: "preencha apenas as informações
// essenciais," duration as quick-pick chips instead of a free-typed number, sticky
// Guardar footer. service === null means create mode: no photo/active-toggle rows,
// since uploadServicePhoto/toggleServiceActive both need a real service id that
// doesn't exist until after the first save — a new service is created active by the
// services.is_active default (true), noted inline rather than shown as a toggle that
// can't actually do anything yet.
export function ServiceEditorSheet({
  service,
  categories,
  onClose,
}: {
  service: ServiceListItem | null;
  categories: CategoryListItem[];
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState<Result<null> | null, FormData>(
    service ? updateService : createService,
    null,
  );
  const [toggleState, toggleFormAction, togglePending] = useActionState<
    Result<null> | null,
    FormData
  >(toggleServiceActive, null);

  const [durationMinutes, setDurationMinutes] = useState(service?.durationMinutes ?? 60);
  const [customMode, setCustomMode] = useState(
    !DURATION_PRESETS.includes(service?.durationMinutes ?? 60),
  );
  const [isActive, setIsActive] = useState(service?.isActive ?? true);

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  if (state?.ok) return null;

  const error = [state, toggleState].find((candidate) => candidate && !candidate.ok) as
    { ok: false; error: { message: string } } | undefined;

  return (
    <BottomSheet
      title={service ? 'Editar serviço' : 'Novo serviço'}
      subtitle={service ? service.name : 'Preencha apenas as informações essenciais.'}
      onClose={onClose}
    >
      <form action={formAction} className="service-editor-form">
        {service ? <input type="hidden" name="id" value={service.id} /> : null}
        <input type="hidden" name="durationMinutes" value={durationMinutes} />
        <div className="stack service-editor-fields">
          <div className="form-field">
            <label className="form-label" htmlFor="service-name">
              Nome
            </label>
            <input
              id="service-name"
              name="name"
              className="form-input"
              defaultValue={service?.name}
              maxLength={120}
              placeholder="Verniz gel"
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="service-price">
              Preço
            </label>
            <div className="form-input-prefix-wrapper">
              <span className="form-input-prefix" aria-hidden="true">
                €
              </span>
              <input
                id="service-price"
                name="priceEuros"
                type="text"
                inputMode="decimal"
                className="form-input form-input-with-prefix"
                defaultValue={service ? formatEurosInputValue(service.priceCents) : undefined}
                placeholder="25,00"
                required
              />
            </div>
          </div>

          <div className="form-field">
            <span className="form-label">Duração</span>
            <div className="duration-options">
              {DURATION_PRESETS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  className="duration-chip"
                  data-active={(!customMode && durationMinutes === minutes) || undefined}
                  onClick={() => {
                    setCustomMode(false);
                    setDurationMinutes(minutes);
                  }}
                >
                  {minutes} min
                </button>
              ))}
              <button
                type="button"
                className="duration-chip"
                data-active={customMode || undefined}
                onClick={() => setCustomMode(true)}
              >
                Personalizado
              </button>
            </div>
            {customMode ? (
              <input
                type="number"
                min={5}
                max={720}
                step={5}
                className="form-input service-editor-custom-duration"
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(Number(event.target.value))}
                aria-label="Duração personalizada em minutos"
              />
            ) : null}
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="service-category">
              Categoria
            </label>
            <select
              id="service-category"
              name="categoryId"
              className="form-input"
              defaultValue={service?.categoryId}
              required
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {category.isVisible ? '' : ' (oculta)'}
                </option>
              ))}
            </select>
          </div>

          {service ? (
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
                    formData.set('id', service.id);
                    toggleFormAction(formData);
                  }}
                />
              </div>
            </div>
          ) : (
            <p className="text-support">Fica disponível para marcação assim que guardar.</p>
          )}

          {service ? (
            <div className="form-field">
              <span className="form-label">Fotografia</span>
              <ServicePhotoUpload serviceId={service.id} photoUrl={service.photoUrl} />
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
            {pending ? 'A guardar…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}
