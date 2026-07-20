'use client';

import { useActionState, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { completeAppointment } from './completion-actions';
import { parseEurosToCents, type QuickPaymentChoice } from './domain/completion';
import {
  extraPriceCents,
  sumExtrasCents,
  type AvailableService,
  type Extra,
} from './domain/extras';
import {
  applyDiscount,
  isValidDiscountValue,
  type Discount,
  type DiscountType,
} from './domain/discount';
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
  compact = false,
}: {
  appointmentId: string;
  expectedTotalCents: number;
  availableServices: AvailableService[];
  /** Agenda timeline row trigger: a bare checkmark icon instead of a "Concluir" button —
   * only the closed-state trigger changes, the expanded form is identical either way. */
  compact?: boolean;
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
  const [discountType, setDiscountType] = useState<DiscountType | null>(null);
  const [discountValueInput, setDiscountValueInput] = useState('');
  const [discountReason, setDiscountReason] = useState('');

  if (state?.ok) {
    return compact ? null : <p role="status">Atendimento concluído.</p>;
  }

  if (!open) {
    if (compact) {
      return (
        <button
          type="button"
          className="appointment-timeline-complete-trigger"
          onClick={() => setOpen(true)}
          aria-label="Concluir atendimento"
        >
          <Check size={16} aria-hidden="true" />
        </button>
      );
    }
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Concluir
      </Button>
    );
  }

  // NEX-112: the discount layers on top of the extras subtotal (expected + extras),
  // same field, same "never overwrite what the owner typed" rule as NEX-111's extras.
  function recomputeSuggestion(nextExtras: Extra[], nextDiscount: Discount | null) {
    if (amountEditedByHand) return;
    const subtotal = expectedTotalCents + sumExtrasCents(nextExtras);
    setAmountInput(formatEurosInputValue(applyDiscount(nextDiscount, subtotal)));
  }

  function currentDiscount(): Discount | null {
    if (discountType === null) return null;
    const value = Number(discountValueInput);
    if (!isValidDiscountValue(discountType, value)) return null;
    return { type: discountType, value, reason: discountReason };
  }

  function addServiceExtra(service: AvailableService) {
    const nextExtras: Extra[] = [
      ...extras,
      {
        kind: 'service',
        serviceId: service.id,
        name: service.name,
        priceCents: service.priceCents,
      },
    ];
    setExtras(nextExtras);
    recomputeSuggestion(nextExtras, currentDiscount());
  }

  function addManualExtra() {
    const priceCents = parseEurosToCents(manualPriceInput);
    if (!manualDescription.trim() || priceCents === null) return;
    const nextExtras: Extra[] = [
      ...extras,
      { kind: 'manual', description: manualDescription.trim(), unitPriceCents: priceCents },
    ];
    setExtras(nextExtras);
    recomputeSuggestion(nextExtras, currentDiscount());
    setManualDescription('');
    setManualPriceInput('');
  }

  function removeExtra(index: number) {
    const nextExtras = extras.filter((_, i) => i !== index);
    setExtras(nextExtras);
    recomputeSuggestion(nextExtras, currentDiscount());
  }

  function updateDiscount(nextType: DiscountType | null, nextValueInput: string) {
    setDiscountType(nextType);
    setDiscountValueInput(nextValueInput);
    if (nextType === null) {
      recomputeSuggestion(extras, null);
      return;
    }
    const value = Number(nextValueInput);
    const discount = isValidDiscountValue(nextType, value)
      ? { type: nextType, value, reason: discountReason }
      : null;
    recomputeSuggestion(extras, discount);
  }

  const parsedCents = parseEurosToCents(amountInput);
  const parsedDiscount = currentDiscount();
  const discountError =
    discountType !== null && parsedDiscount === null
      ? discountType === 'percent'
        ? 'O desconto percentual deve ser entre 0 e 100.'
        : 'O valor do desconto deve ser positivo.'
      : null;
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
      <input type="hidden" name="discountType" value={parsedDiscount?.type ?? ''} />
      <input type="hidden" name="discountValue" value={parsedDiscount?.value ?? ''} />
      <input type="hidden" name="discountReason" value={discountReason} />
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

          <div className="completion-discount">
            <label>
              Desconto
              <select
                value={discountType ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  updateDiscount(value === '' ? null : (value as DiscountType), discountValueInput);
                }}
              >
                <option value="">Sem desconto</option>
                <option value="fixed">Valor fixo (€)</option>
                <option value="percent">Percentagem (%)</option>
              </select>
            </label>
            {discountType !== null ? (
              <>
                <label>
                  {discountType === 'fixed' ? 'Valor (€)' : 'Percentagem (%)'}
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max={discountType === 'percent' ? 100 : undefined}
                    step={discountType === 'fixed' ? '0.01' : '1'}
                    value={discountValueInput}
                    onChange={(event) => updateDiscount(discountType, event.target.value)}
                  />
                </label>
                <label>
                  Motivo (opcional)
                  <input
                    type="text"
                    maxLength={200}
                    value={discountReason}
                    onChange={(event) => setDiscountReason(event.target.value)}
                  />
                </label>
                {discountError ? (
                  <p role="alert" className="form-error">
                    {discountError}
                  </p>
                ) : null}
              </>
            ) : null}
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
        <Button
          type="submit"
          disabled={pending || !choice || parsedCents === null || discountError !== null}
        >
          {pending ? 'A concluir…' : 'Confirmar conclusão'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Voltar
        </Button>
      </div>
    </form>
  );
}
