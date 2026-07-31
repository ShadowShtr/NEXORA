'use client';

import { useActionState, useEffect, useState } from 'react';
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
// (docs/01_PRODUCT_REQUIREMENTS.md §9). Visual refinement mid-2026: this used to be an
// inline reveal-in-place panel on the agenda card itself — the reference flagged that as
// the single biggest visual problem (a card growing to 500-600px destroys the timeline),
// so the open/closed toggle moved out to a bottom sheet (CompletionSheet.tsx) that owns
// visibility; this component is now just the form, always rendered when mounted, with
// onCompleted/onCancel telling the sheet when to close.
export function AppointmentCompletionPanel({
  appointmentId,
  expectedTotalCents,
  availableServices,
  onCompleted,
  onCancel,
}: {
  appointmentId: string;
  expectedTotalCents: number;
  availableServices: AvailableService[];
  onCompleted?: () => void;
  onCancel?: () => void;
}) {
  const [state, formAction, pending] = useActionState<Result<null> | null, FormData>(
    completeAppointment,
    null,
  );
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

  useEffect(() => {
    if (state?.ok) onCompleted?.();
  }, [state, onCompleted]);

  if (state?.ok) {
    return null;
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
    // "Valor (€)" is a euro field like "Valor final (€)" — computeDiscountCents treats
    // Discount.value as cents for the fixed type (mirrors complete_appointment's RPC), so
    // it must go through the same euro->cents parsing as the final total, not a bare
    // Number() (which previously read "5.00" as the integer 5, discounting 5 cents
    // instead of 5 euros — a real under-discount bug, not just a stale test).
    const value =
      discountType === 'fixed' ? parseEurosToCents(discountValueInput) : Number(discountValueInput);
    if (value === null || !isValidDiscountValue(discountType, value)) return null;
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
    // Can't call currentDiscount() here — setDiscountType/setDiscountValueInput above
    // haven't committed yet, so it would still read the previous render's state. Same
    // euro->cents conversion as currentDiscount() for the 'fixed' type (see its comment).
    const value = nextType === 'fixed' ? parseEurosToCents(nextValueInput) : Number(nextValueInput);
    const discount =
      value !== null && isValidDiscountValue(nextType, value)
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
        <Button type="button" variant="secondary" onClick={onCancel}>
          Voltar
        </Button>
      </div>
    </form>
  );
}
