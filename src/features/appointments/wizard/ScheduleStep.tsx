'use client';

import { AvailabilityCalendar } from '../AvailabilityCalendar';
import type { RecurrenceFrequency } from '../domain/recurrence';

const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  three_weeks: 'A cada 3 semanas',
  monthly: 'Mensal',
  custom: 'Personalizado',
};

// Step 3 — "Quando será a marcação?" The calendar + time-of-day list itself
// (AvailabilityCalendar.tsx) reuses the exact domain modules the public booking flow
// already ships and the same calendar CSS language — same widget the owner already
// sees in her own public booking page preview, now also shared with the appointment
// detail page's reschedule form (AppointmentPrimaryActions.tsx), the other place a slot
// needs picking from real availability instead of a blind date/time input.
// Availability itself still comes from the authenticated getManualBookingAvailability
// (NEX-085), fetched by the parent wizard.
export function ScheduleStep({
  totalMinutes,
  timezone,
  slots,
  slotsError,
  selectedSlotIso,
  onSelectSlot,
  recurringEnabled,
  onToggleRecurring,
  frequency,
  onFrequencyChange,
  occurrenceCount,
  onOccurrenceCountChange,
  customIntervalDays,
  onCustomIntervalDaysChange,
  conflictsError,
  observation,
  onObservationChange,
}: {
  totalMinutes: number;
  timezone: string;
  slots: string[] | null;
  slotsError: string | null;
  selectedSlotIso: string | null;
  onSelectSlot: (iso: string) => void;
  recurringEnabled: boolean;
  onToggleRecurring: (enabled: boolean) => void;
  frequency: RecurrenceFrequency;
  onFrequencyChange: (frequency: RecurrenceFrequency) => void;
  occurrenceCount: number;
  onOccurrenceCountChange: (count: number) => void;
  customIntervalDays: number;
  onCustomIntervalDaysChange: (days: number) => void;
  conflictsError: string | null;
  observation: string;
  onObservationChange: (value: string) => void;
}) {
  if (totalMinutes <= 0) {
    return (
      <div className="step-heading">
        <h2 className="step-title">Quando será a marcação?</h2>
        <p className="step-description">
          Os horários são calculados com base na duração selecionada.
        </p>
        <div className="schedule-disabled-state">
          <p className="schedule-disabled-title">Selecione primeiro os serviços.</p>
          <p className="text-support">
            A duração dos serviços é necessária para calcular os horários disponíveis.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="step-heading">
      <h2 className="step-title">Quando será a marcação?</h2>
      <p className="step-description">
        Os horários são calculados com base na duração selecionada.
      </p>

      <AvailabilityCalendar
        totalMinutes={totalMinutes}
        timezone={timezone}
        slots={slots}
        slotsError={slotsError}
        selectedSlotIso={selectedSlotIso}
        onSelectSlot={onSelectSlot}
      />

      <div className="recurrence-toggle-card">
        <span className="recurrence-toggle-text">
          <span className="recurrence-toggle-title">Repetir esta marcação</span>
          <span className="text-support">Crie automaticamente as próximas marcações.</span>
        </span>
        <button
          type="button"
          className="service-toggle"
          role="switch"
          aria-checked={recurringEnabled}
          aria-label={recurringEnabled ? 'Desativar repetição' : 'Ativar repetição'}
          data-active={recurringEnabled || undefined}
          onClick={() => onToggleRecurring(!recurringEnabled)}
        />
      </div>

      {recurringEnabled ? (
        <div className="recurrence-config">
          <div className="form-field">
            <label className="form-label" htmlFor="recurrence-frequency">
              Frequência
            </label>
            <select
              id="recurrence-frequency"
              className="form-input"
              value={frequency}
              onChange={(event) => onFrequencyChange(event.target.value as RecurrenceFrequency)}
            >
              {(Object.keys(FREQUENCY_LABELS) as RecurrenceFrequency[]).map((value) => (
                <option key={value} value={value}>
                  {FREQUENCY_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          {frequency === 'custom' ? (
            <div className="form-field">
              <label className="form-label" htmlFor="recurrence-interval">
                Repetir a cada quantos dias
              </label>
              <input
                id="recurrence-interval"
                type="number"
                className="form-input"
                min={1}
                max={52}
                value={customIntervalDays}
                onChange={(event) => onCustomIntervalDaysChange(Number(event.target.value))}
              />
            </div>
          ) : null}

          <div className="form-field">
            <label className="form-label" htmlFor="recurrence-count">
              Número de marcações (incluindo esta)
            </label>
            <input
              id="recurrence-count"
              type="number"
              className="form-input"
              min={2}
              max={52}
              value={occurrenceCount}
              onChange={(event) => onOccurrenceCountChange(Number(event.target.value))}
            />
          </div>

          {conflictsError ? (
            <p role="alert" className="form-error">
              {conflictsError}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="appointment-notes">
        <label className="form-label" htmlFor="appointment-notes-textarea">
          Observação (opcional)
        </label>
        <textarea
          id="appointment-notes-textarea"
          className="appointment-notes-textarea"
          maxLength={2000}
          rows={3}
          placeholder="Informações importantes para este atendimento"
          value={observation}
          onChange={(event) => onObservationChange(event.target.value)}
        />
      </div>
    </div>
  );
}
