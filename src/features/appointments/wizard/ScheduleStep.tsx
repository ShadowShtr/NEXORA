'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { buildCalendarMonth, shiftMonthKey } from '@/app/b/[slug]/domain/month-calendar';
import { groupSlotsByDay } from '@/app/b/[slug]/domain/slot-formatting';
import type { RecurrenceFrequency } from '../domain/recurrence';

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function weekdayLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number) as [number, number, number];
  return WEEKDAY_SHORT[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]!;
}

const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  three_weeks: 'A cada 3 semanas',
  monthly: 'Mensal',
  custom: 'Personalizado',
};

// Step 3 — "Quando será a marcação?" The calendar + time-of-day list reuses the exact
// domain modules the public booking flow already ships (buildCalendarMonth/
// shiftMonthKey/groupSlotsByDay, src/app/b/[slug]/domain) and the same calendar CSS
// language (.calendar/.calendar-day/.public-slot-*) — same widget the owner already
// sees in her own public booking page preview, not a second calendar implementation
// with its own quirks. Availability itself still comes from the authenticated
// getManualBookingAvailability (NEX-085), fetched by the parent wizard.
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
  const [todayKey] = useState(() => formatInTimeZone(Date.now(), timezone, 'yyyy-MM-dd'));
  const [monthKey, setMonthKey] = useState(todayKey.slice(0, 7));
  const [pickedDateKey, setPickedDateKey] = useState<string | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(
    () => (slots ? groupSlotsByDay(slots, timezone, totalMinutes) : []),
    [slots, timezone, totalMinutes],
  );
  const groupsByDateKey = useMemo(() => {
    const map = new Map<string, (typeof groups)[number]>();
    for (const group of groups) map.set(group.dateKey, group);
    return map;
  }, [groups]);

  const selectedDateKey =
    pickedDateKey && groupsByDateKey.has(pickedDateKey)
      ? pickedDateKey
      : (groups[0]?.dateKey ?? null);
  const selectedGroup = selectedDateKey ? groupsByDateKey.get(selectedDateKey) : undefined;

  // The strip only shows one screen's worth of days — without this, the default/picked
  // day (never the 1st of the month, since past days are disabled) would land scrolled
  // out of view with no hint it's even there. Matches SlotPicker.tsx (public booking).
  useEffect(() => {
    if (!selectedDateKey || !stripRef.current) return;
    const el = stripRef.current.querySelector<HTMLElement>(`[data-date-key="${selectedDateKey}"]`);
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selectedDateKey, monthKey]);

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

      {slotsError ? (
        <p role="alert" className="form-error">
          {slotsError}
        </p>
      ) : slots === null ? (
        <p aria-live="polite" className="text-support">
          A carregar horários…
        </p>
      ) : groups.length === 0 ? (
        <p className="text-support">Sem horários disponíveis nos próximos dias.</p>
      ) : (
        <>
          <div className="calendar">
            <div className="calendar-header">
              <button
                type="button"
                className="calendar-nav"
                aria-label="Mês anterior"
                onClick={() => setMonthKey((key) => shiftMonthKey(key, -1))}
              >
                ‹
              </button>
              <p className="calendar-month-label">
                {buildCalendarMonth(monthKey, new Set(groupsByDateKey.keys()), todayKey).label}
              </p>
              <button
                type="button"
                className="calendar-nav"
                aria-label="Mês seguinte"
                onClick={() => setMonthKey((key) => shiftMonthKey(key, 1))}
              >
                ›
              </button>
            </div>

            <div className="calendar-strip" role="grid" ref={stripRef}>
              {buildCalendarMonth(monthKey, new Set(groupsByDateKey.keys()), todayKey)
                .days.filter((day) => day.inCurrentMonth)
                .map((day) => {
                  const disabled = day.isPast || !day.hasSlots;
                  const selected = selectedDateKey === day.dateKey;
                  return (
                    <button
                      key={day.dateKey}
                      type="button"
                      role="gridcell"
                      className="calendar-day"
                      data-date-key={day.dateKey}
                      data-has-slots={day.hasSlots}
                      aria-selected={selected}
                      aria-label={day.dateKey}
                      disabled={disabled}
                      onClick={() => setPickedDateKey(day.dateKey)}
                    >
                      <span className="calendar-day-weekday">{weekdayLabel(day.dateKey)}</span>
                      <span className="calendar-day-number">{day.dayOfMonth}</span>
                    </button>
                  );
                })}
            </div>
          </div>

          {selectedGroup ? (
            <div className="calendar-times">
              <p className="calendar-times-label">Horários disponíveis</p>
              <ul className="public-slot-list">
                {selectedGroup.slots.map((slot) => (
                  <li key={slot.iso}>
                    <button
                      type="button"
                      className="public-slot-button"
                      aria-pressed={selectedSlotIso === slot.iso}
                      onClick={() => onSelectSlot(slot.iso)}
                    >
                      {slot.timeLabel}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}

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
