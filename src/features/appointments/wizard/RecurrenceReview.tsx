'use client';

import type { Dispatch, SetStateAction } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { pt } from 'date-fns/locale/pt';
import { Button } from '@/components/ui/Button';
import { capitalize } from '../domain/appointment-wizard';
import type { RecurrenceFrequency } from '../domain/recurrence';
import type { ClientSelection } from './ClientStep';
import type { Result } from '@/lib/result';

export type OccurrenceReview = {
  originalIso: string;
  hasConflict: boolean;
  alternativesIso: string[];
  chosenIso: string;
  removed: boolean;
};

const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  three_weeks: 'A cada 3 semanas',
  monthly: 'Mensal',
  custom: 'Intervalo personalizado',
};

// NEX-122's conflict-resolution UI, unchanged in behaviour — every occurrence is either
// free, auto-resolved by picking an alternative, or blocking submission until the owner
// resolves it (picks an alternative or drops the occurrence). Only the presentation
// changed: this used to be a plain <ul> of public-service-item rows inline in
// ManualBookingForm; now its own step, restyled to match the wizard's card language.
export function RecurrenceReview({
  occurrenceReviews,
  setOccurrenceReviews,
  frequency,
  timezone,
  clientSelection,
  selectedServiceIds,
  selectedPackageId,
  observation,
  intervalValue,
  formAction,
  pending,
  state,
  onBack,
}: {
  occurrenceReviews: OccurrenceReview[];
  setOccurrenceReviews: Dispatch<SetStateAction<OccurrenceReview[] | null>>;
  frequency: RecurrenceFrequency;
  timezone: string;
  clientSelection: ClientSelection;
  selectedServiceIds: Set<string>;
  selectedPackageId: string | null;
  observation: string;
  intervalValue: number;
  formAction: (formData: FormData) => void;
  pending: boolean;
  state: Result<{ seriesId: string }> | null;
  onBack: () => void;
}) {
  const remaining = occurrenceReviews.filter((occurrence) => !occurrence.removed);
  const hasUnresolvedConflict = remaining.some(
    (occurrence) => occurrence.hasConflict && occurrence.chosenIso === occurrence.originalIso,
  );
  const canConfirm = remaining.length >= 2 && !hasUnresolvedConflict;

  function pickAlternative(originalIso: string, alternativeIso: string) {
    setOccurrenceReviews(
      (current) =>
        current?.map((occurrence) =>
          occurrence.originalIso === originalIso
            ? { ...occurrence, chosenIso: alternativeIso, removed: false }
            : occurrence,
        ) ?? null,
    );
  }

  function toggleRemoved(originalIso: string) {
    setOccurrenceReviews(
      (current) =>
        current?.map((occurrence) =>
          occurrence.originalIso === originalIso
            ? { ...occurrence, removed: !occurrence.removed }
            : occurrence,
        ) ?? null,
    );
  }

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
      <input type="hidden" name="observation" value={observation} />
      <input type="hidden" name="frequency" value={frequency} />
      <input type="hidden" name="intervalValue" value={intervalValue} />
      {remaining.map((occurrence) => (
        <input
          key={occurrence.originalIso}
          type="hidden"
          name="occurrencesIso"
          value={occurrence.chosenIso}
        />
      ))}

      <h2 className="step-title">Rever ocorrências</h2>
      <p className="step-description">
        {FREQUENCY_LABELS[frequency]} · {remaining.length} de {occurrenceReviews.length} marcações
      </p>

      <ul className="recurrence-occurrence-list">
        {occurrenceReviews.map((occurrence) => {
          const isResolvedConflict =
            occurrence.hasConflict && occurrence.chosenIso !== occurrence.originalIso;
          return (
            <li key={occurrence.originalIso} className="recurrence-occurrence-card">
              <div className="recurrence-occurrence-row">
                <span className={occurrence.removed ? 'recurrence-occurrence-removed' : undefined}>
                  {capitalize(
                    formatInTimeZone(occurrence.chosenIso, timezone, "EEEE, dd/MM 'às' HH:mm", {
                      locale: pt,
                    }),
                  )}
                </span>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => toggleRemoved(occurrence.originalIso)}
                >
                  {occurrence.removed ? 'Readicionar' : 'Remover'}
                </button>
              </div>

              {!occurrence.removed && occurrence.hasConflict ? (
                isResolvedConflict ? (
                  <p className="text-support">Substituída por horário livre acima.</p>
                ) : (
                  <div className="stack">
                    <p role="alert" className="form-error">
                      Este horário já está ocupado.
                    </p>
                    {occurrence.alternativesIso.length > 0 ? (
                      <ul className="public-slot-list">
                        {occurrence.alternativesIso.map((alternativeIso) => (
                          <li key={alternativeIso}>
                            <button
                              type="button"
                              className="public-slot-button"
                              onClick={() =>
                                pickAlternative(occurrence.originalIso, alternativeIso)
                              }
                            >
                              {formatInTimeZone(alternativeIso, timezone, 'dd/MM HH:mm')}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-support">Sem alternativas próximas disponíveis.</p>
                    )}
                  </div>
                )
              ) : null}
            </li>
          );
        })}
      </ul>

      {remaining.length < 2 ? (
        <p role="alert" className="form-error">
          Uma série precisa de pelo menos 2 marcações.
        </p>
      ) : null}

      {state && !state.ok ? (
        <p role="alert" className="form-error">
          {state.error.message}
        </p>
      ) : null}

      <div className="wizard-actions">
        <Button type="button" variant="secondary" onClick={onBack}>
          Voltar
        </Button>
        <Button type="submit" disabled={pending || !canConfirm}>
          {pending ? 'A criar…' : `Confirmar ${remaining.length} marcações`}
        </Button>
      </div>
    </form>
  );
}
