'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { createResource, setResourceActive, updateResource } from './resource-actions';
import type { ResourceListItem, ServiceOption } from './queries';

const TYPE_OPTIONS: { value: ResourceListItem['type']; label: string }[] = [
  { value: 'room', label: 'Sala' },
  { value: 'equipment', label: 'Equipamento' },
  { value: 'chair', label: 'Cadeira' },
  { value: 'other', label: 'Outro' },
];

export function ResourceEditorSheet({
  resource,
  serviceOptions,
  initialResourceServiceIds,
  onClose,
}: {
  resource: ResourceListItem | null;
  serviceOptions: ServiceOption[];
  initialResourceServiceIds: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(resource?.name ?? '');
  const [type, setType] = useState<ResourceListItem['type']>(resource?.type ?? 'room');
  const [location, setLocation] = useState(resource?.location ?? '');
  const [isActive, setIsActive] = useState(resource?.isActive ?? true);
  const [serviceIds, setServiceIds] = useState<string[]>(initialResourceServiceIds);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleService(serviceId: string) {
    setServiceIds((current) =>
      current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId],
    );
  }

  async function handleSave() {
    setPending(true);
    setError(null);

    const result = resource
      ? await updateResource({ id: resource.id, name, type, location, serviceIds })
      : await createResource({ name, type, location, serviceIds });
    if (!result.ok) {
      setPending(false);
      setError(result.error.message);
      return;
    }

    if (resource && isActive !== resource.isActive) {
      const activeResult = await setResourceActive({ id: resource.id, isActive });
      if (!activeResult.ok) {
        setPending(false);
        setError(activeResult.error.message);
        return;
      }
    }

    setPending(false);
    router.refresh();
    onClose();
  }

  return (
    <BottomSheet title={resource ? resource.name : 'Nova sala ou equipamento'} onClose={onClose}>
      <div className="stack service-editor-fields">
        <div className="form-field">
          <label className="form-label" htmlFor="resource-name">
            Nome
          </label>
          <input
            id="resource-name"
            className="form-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            placeholder="Sala 1"
          />
        </div>

        <div className="form-field">
          <span className="form-label">Tipo</span>
          <select
            className="form-input"
            value={type}
            onChange={(event) => setType(event.target.value as ResourceListItem['type'])}
          >
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="resource-location">
            Localização (opcional)
          </label>
          <input
            id="resource-location"
            className="form-input"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            maxLength={200}
            placeholder="Piso 1"
          />
        </div>

        <div className="form-field">
          <span className="form-label">Serviços associados</span>
          {serviceOptions.length === 0 ? (
            <p className="text-support">Ainda não existem serviços ativos.</p>
          ) : (
            <ul className="team-service-picker">
              {serviceOptions.map((service) => (
                <li key={service.id}>
                  <label className="team-service-picker-row">
                    <input
                      type="checkbox"
                      checked={serviceIds.includes(service.id)}
                      onChange={() => toggleService(service.id)}
                    />
                    {service.name}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        {resource ? (
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
                onClick={() => setIsActive((current) => !current)}
              />
            </div>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="form-error">
            {error}
          </p>
        ) : null}
      </div>

      <div className="form-sticky-footer">
        <Button disabled={pending || name.trim().length === 0} onClick={handleSave}>
          {pending ? 'A guardar…' : resource ? 'Guardar' : 'Criar'}
        </Button>
      </div>
    </BottomSheet>
  );
}
