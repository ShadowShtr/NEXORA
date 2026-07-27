'use client';

import { formatInTimeZone } from 'date-fns-tz';
import { pt } from 'date-fns/locale/pt';
import { Button } from '@/components/ui/Button';
import type { ServiceLine } from '@/app/b/[slug]/domain/booking-selection';
import { capitalize, formatDurationLabel, formatEuros } from '../domain/appointment-wizard';
import type { RecurrenceFrequency } from '../domain/recurrence';
import type { ClientSelection } from './ClientStep';
import type { Result } from '@/lib/result';

const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  three_weeks: 'A cada 3 semanas',
  monthly: 'Mensal',
  custom: 'Intervalo personalizado',
};

// Step 4 — "Confirmar marcação." A read-only summary of every decision made in steps
// 1-3, each section with its own "Editar" jump back — CLAUDE.md's "uma decisão
// importante por ecrã" doesn't mean the owner can't double-check everything before
// committing, only that she isn't asked to hold every decision in her head at once while
// making them.
export function ConfirmStep({
  clientSelection,
  lines,
  selectedServiceIds,
  selectedPackageId,
  totalCents,
  totalMinutes,
  selectedSlotIso,
  timezone,
  recurringEnabled,
  frequency,
  occurrenceCount,
  observation,
  onEditStep,
  formAction,
  pending,
  state,
}: {
  clientSelection: ClientSelection;
  lines: ServiceLine[];
  selectedServiceIds: Set<string>;
  selectedPackageId: string | null;
  totalCents: number;
  totalMinutes: number;
  selectedSlotIso: string | null;
  timezone: string;
  recurringEnabled: boolean;
  frequency: RecurrenceFrequency;
  occurrenceCount: number;
  observation: string;
  onEditStep: (step: 'client' | 'services' | 'schedule') => void;
  formAction: (formData: FormData) => void;
  pending: boolean;
  state: Result<{ appointmentId: string }> | null;
}) {
  const endIso = selectedSlotIso
    ? new Date(new Date(selectedSlotIso).getTime() + totalMinutes * 60_000).toISOString()
    : null;

  return (
    <form action={formAction} className="step-heading">
      {clientSelection.mode === 'existing' ? (
        <input type="hidden" name="clientId" value={clientSelection.client.id} />
      ) : clientSelection.mode === 'new' ? (
        <>
          <input type="hidden" name="clientId" value="" />
          <input type="hidden" name="clientName" value={clientSelection.name} />
          <input type="hidden" name="clientPhone" value={clientSelection.phone} />
          <input type="hidden" name="clientEmail" value={clientSelection.email} />
        </>
      ) : null}
      {Array.from(selectedServiceIds).map((id) => (
        <input key={id} type="hidden" name="selectedServiceIds" value={id} />
      ))}
      {selectedPackageId ? (
        <input type="hidden" name="selectedPackageId" value={selectedPackageId} />
      ) : null}
      <input type="hidden" name="startAtIso" value={selectedSlotIso ?? ''} />
      <input type="hidden" name="observation" value={observation} />

      <h2 className="step-title">Confirmar marcação</h2>
      <p className="step-description">Verifique os dados antes de concluir.</p>

      <div className="appointment-review-card">
        <div className="appointment-review-section">
          <div className="appointment-review-section-header">
            <p className="text-eyebrow">Cliente</p>
            <button type="button" className="link-button" onClick={() => onEditStep('client')}>
              Editar
            </button>
          </div>
          {clientSelection.mode === 'existing' ? (
            <>
              <p>{clientSelection.client.name}</p>
              <p className="text-support">{clientSelection.client.phoneE164}</p>
            </>
          ) : clientSelection.mode === 'new' ? (
            <>
              <p>{clientSelection.name}</p>
              <p className="text-support">{clientSelection.phone}</p>
              {clientSelection.email ? (
                <p className="text-support">{clientSelection.email}</p>
              ) : null}
            </>
          ) : (
            <p className="text-support">Nenhuma cliente selecionada.</p>
          )}
        </div>

        <div className="appointment-review-section">
          <div className="appointment-review-section-header">
            <p className="text-eyebrow">Serviços</p>
            <button type="button" className="link-button" onClick={() => onEditStep('services')}>
              Editar
            </button>
          </div>
          {lines.length === 0 ? (
            <p className="text-support">Nenhum serviço selecionado.</p>
          ) : (
            <ul className="appointment-review-service-list">
              {lines.map((line) => (
                <li key={line.id}>
                  <span>{line.name}</span>
                  <span>{formatEuros(line.priceCents)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="appointment-review-section">
          <div className="appointment-review-section-header">
            <p className="text-eyebrow">Data e hora</p>
            <button type="button" className="link-button" onClick={() => onEditStep('schedule')}>
              Editar
            </button>
          </div>
          {selectedSlotIso && endIso ? (
            <>
              <p>
                {capitalize(
                  formatInTimeZone(selectedSlotIso, timezone, "EEEE, dd 'de' MMMM", { locale: pt }),
                )}
              </p>
              <p className="text-support">
                {formatInTimeZone(selectedSlotIso, timezone, 'HH:mm')}–
                {formatInTimeZone(endIso, timezone, 'HH:mm')}
              </p>
            </>
          ) : (
            <p className="text-support">Nenhum horário selecionado.</p>
          )}
        </div>

        {recurringEnabled ? (
          <div className="appointment-review-section">
            <div className="appointment-review-section-header">
              <p className="text-eyebrow">Recorrência</p>
              <button type="button" className="link-button" onClick={() => onEditStep('schedule')}>
                Editar
              </button>
            </div>
            <p>
              {FREQUENCY_LABELS[frequency]} · {occurrenceCount} marcações
            </p>
          </div>
        ) : null}

        {observation ? (
          <div className="appointment-review-section">
            <p className="text-eyebrow">Observação</p>
            <p className="text-support">{observation}</p>
          </div>
        ) : null}

        <div className="appointment-review-total">
          <span>{formatDurationLabel(totalMinutes)}</span>
          <span className="appointment-review-total-value">{formatEuros(totalCents)}</span>
        </div>
      </div>

      {state && !state.ok ? (
        <p role="alert" className="form-error">
          {state.error.message}
        </p>
      ) : null}

      <div className="wizard-actions">
        <Button type="button" variant="secondary" onClick={() => onEditStep('schedule')}>
          Voltar
        </Button>
        <Button
          type="submit"
          disabled={
            pending || !selectedSlotIso || lines.length === 0 || clientSelection.mode === 'none'
          }
        >
          {pending ? 'A criar…' : 'Criar marcação'}
        </Button>
      </div>
    </form>
  );
}
