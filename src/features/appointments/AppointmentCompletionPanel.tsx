'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { completeAppointment } from './completion-actions';
import { parseEurosToCents, type QuickPaymentChoice } from './domain/completion';
import {
  extraPriceCents,
  sumExtrasCents,
  type AvailableService,
  type Extra,
} from './domain/extras';
import type { Result } from '@/lib/result';

function formatEurosInputValue(cents: number): string {
  return (cents / 100).toFixed(2);
}

function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

// NEX-110/NEX-111: "janela rápida mostra valor e forma de pagamento... em poucos
// toques" + "Ver mais permite extras... serviço existente ou ajuste manual"
// (docs/01_PRODUCT_REQUIREMENTS.md §9) — an inline reveal-in-place panel, the same
// pattern already used for cancel/reschedule/mark-no-show (AppointmentDetailActions.tsx)
// rather than a new overlay/dialog component. Adding an extra recomputes the value
// field's suggestion (expected total + extras) but only while the owner hasn't typed
// into that field herself — "valor final é ajustável" means her own edit always wins
// over the auto-suggestion, matching how NEX-112's discount will layer on top of this
// same field later.
export function AppointmentCompletionPanel({
  appointmentId,
  expectedTotalCents,
  availableServices,
}: {
  appointmentId: string;
  expectedTotalCents: number;
  availableServices: AvailableService[];
}) {
  const [state, formAction, pending] = useActionState<Result<null> | null, FormData>(
    completeAppointment,
    null,
  );
  const [open, setOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [amountInput, setAmountInput] = useState(formatEurosInputValue(expectedTotalCents));
  const [amountEditedByHand, setAmountEditedByHand] = useState(false);
  const [choice, setChoice] = useState<QuickPaymentChoice | null>(null);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [manualDescription, setManualDescription] = useState('');
  const [manualPriceInput, setManualPriceInput] = useState('');

  if (state?.ok) {
    return <p role="status">Atendimento concluído.</p>;
  }

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Concluir
      </Button>
    );
  }

  function applyExtras(nextExtras: Extra[]) {
    setExtras(nextExtras);
    if (!amountEditedByHand) {
      setAmountInput(formatEurosInputValue(expectedTotalCents + sumExtrasCents(nextExtras)));
    }
  }

  function addServiceExtra(service: AvailableService) {
    applyExtras([
      ...extras,
      {
        kind: 'service',
        serviceId: service.id,
        name: service.name,
        priceCents: service.priceCents,
      },
    ]);
  }

  function addManualExtra() {
    const priceCents = parseEurosToCents(manualPriceInput);
    if (!manualDescription.trim() || priceCents === null) return;
    applyExtras([
      ...extras,
      { kind: 'manual', description: manualDescription.trim(), unitPriceCents: priceCents },
    ]);
    setManualDescription('');
    setManualPriceInput('');
  }

  function removeExtra(index: number) {
    applyExtras(extras.filter((_, i) => i !== index));
  }

  const parsedCents = parseEurosToCents(amountInput);
  const serviceExtraIds = extras
    .filter((extra): extra is Extra & { kind: 'service' } => extra.kind === 'service')
    .map((extra) => extra.serviceId);
  const manualExtrasJson = JSON.stringify(
    extras
      .filter((extra): extra is Extra & { kind: 'manual' } => extra.kind === 'manual')
      .map((extra) => ({ description: extra.description, unitPriceCents: extra.unitPriceCents })),
  );

  return (
    <form action={formAction} className="stack completion-panel">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input type="hidden" name="finalTotalCents" value={parsedCents ?? ''} />
      <input type="hidden" name="extraServiceIds" value={serviceExtraIds.join(',')} />
      <input type="hidden" name="manualExtras" value={manualExtrasJson} />
      <label>
        Valor final (€)
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={amountInput}
          onChange={(event) => {
            setAmountInput(event.target.value);
            setAmountEditedByHand(true);
          }}
        />
      </label>

      {!showMore ? (
        <Button type="button" variant="secondary" onClick={() => setShowMore(true)}>
          Ver mais
        </Button>
      ) : (
        <div className="stack completion-extras">
          {extras.length > 0 ? (
            <ul className="completion-extras-list">
              {extras.map((extra, index) => (
                <li key={index}>
                  <span>{extra.kind === 'service' ? extra.name : extra.description}</span>
                  <span>{formatEuros(extraPriceCents(extra))}</span>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => removeExtra(index)}
                    aria-label={`Remover ${extra.kind === 'service' ? extra.name : extra.description}`}
                  >
                    Remover
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}

          {availableServices.length > 0 ? (
            <label>
              Adicionar serviço
              <select
                value=""
                onChange={(event) => {
                  const service = availableServices.find((s) => s.id === event.target.value);
                  if (service) addServiceExtra(service);
                }}
              >
                <option value="">Escolher…</option>
                {availableServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} ({formatEuros(service.priceCents)})
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="completion-manual-extra">
            <label>
              Ajuste manual — descrição
              <input
                type="text"
                maxLength={200}
                value={manualDescription}
                onChange={(event) => setManualDescription(event.target.value)}
              />
            </label>
            <label>
              Valor (€)
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={manualPriceInput}
                onChange={(event) => setManualPriceInput(event.target.value)}
              />
            </label>
            <Button type="button" variant="secondary" onClick={addManualExtra}>
              Adicionar
            </Button>
          </div>
        </div>
      )}

      <div className="completion-panel-choices">
        <Button
          type="button"
          variant={choice === 'cash' ? 'primary' : 'secondary'}
          onClick={() => setChoice('cash')}
        >
          Dinheiro
        </Button>
        <Button
          type="button"
          variant={choice === 'mbway' ? 'primary' : 'secondary'}
          onClick={() => setChoice('mbway')}
        >
          MB WAY
        </Button>
        <Button
          type="button"
          variant={choice === 'pending' ? 'primary' : 'secondary'}
          onClick={() => setChoice('pending')}
        >
          Pendente
        </Button>
      </div>
      <input type="hidden" name="paymentChoice" value={choice ?? ''} />
      {state && !state.ok ? (
        <p role="alert" className="form-error">
          {state.error.message}
        </p>
      ) : null}
      {parsedCents === null ? (
        <p role="alert" className="form-error">
          Valor inválido.
        </p>
      ) : null}
      <div className="wizard-actions">
        <Button type="submit" disabled={pending || !choice || parsedCents === null}>
          {pending ? 'A concluir…' : 'Confirmar conclusão'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Voltar
        </Button>
      </div>
    </form>
  );
}
