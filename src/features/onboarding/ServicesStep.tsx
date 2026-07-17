'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { addService, advanceServicesStep, goToPreviousStep } from '@/features/onboarding/actions';
import type { ServiceListItem } from '@/features/onboarding/domain/services-step';
import type { Result } from '@/lib/result';

type ServicesStepProps = {
  services: ServiceListItem[];
};

function formatEuros(cents: number) {
  return (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

export function ServicesStep({ services }: ServicesStepProps) {
  const [addState, addFormAction, addPending] = useActionState<Result<null> | null, FormData>(
    addService,
    null,
  );
  const [advanceState, advanceFormAction, advancePending] = useActionState<
    Result<null> | null,
    FormData
  >(advanceServicesStep, null);

  return (
    <div className="stack">
      {services.length > 0 ? (
        <ul className="services-list" aria-label="Serviços adicionados">
          {services.map((service) => (
            <li key={service.id}>
              <strong>{service.name}</strong>
              <span>
                {formatEuros(service.priceCents)} · {service.durationMinutes} min ·{' '}
                {service.categoryName}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p>Ainda não adicionou nenhum serviço.</p>
      )}

      <form className="stack" aria-label="Adicionar serviço" action={addFormAction}>
        <label>
          Nome do serviço
          <input name="name" required maxLength={120} />
        </label>
        <label>
          Preço (€)
          <input name="priceEuros" type="text" inputMode="decimal" required placeholder="25,00" />
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
          <input name="categoryName" required maxLength={80} placeholder="Manicure" />
        </label>
        {addState && !addState.ok ? (
          <p role="alert" className="form-error">
            {addState.error.message}
          </p>
        ) : null}
        <Button type="submit" disabled={addPending}>
          {addPending ? 'A adicionar…' : 'Adicionar serviço'}
        </Button>
      </form>

      <form action={advanceFormAction}>
        {advanceState && !advanceState.ok ? (
          <p role="alert" className="form-error">
            {advanceState.error.message}
          </p>
        ) : null}
        <div className="wizard-actions">
          <Button type="submit" formAction={goToPreviousStep} disabled={advancePending}>
            Voltar
          </Button>
          <Button type="submit" disabled={advancePending}>
            {advancePending ? 'A continuar…' : 'Seguinte'}
          </Button>
        </div>
      </form>
    </div>
  );
}
