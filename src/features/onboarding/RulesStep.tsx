'use client';

import { useActionState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { goToPreviousStep, submitRulesStep } from '@/features/onboarding/actions';
import {
  BOOKING_WINDOW_DAYS_OPTIONS,
  BUFFER_MINUTES_OPTIONS,
  CANCELLATION_NOTICE_HOURS_OPTIONS,
  MIN_NOTICE_HOURS_OPTIONS,
  RECOMMENDED_RULES,
  SLOT_INTERVAL_OPTIONS,
} from '@/features/onboarding/domain/rules-step';
import type { Result } from '@/lib/result';

type RulesStepProps = {
  initialValues: {
    slotIntervalMinutes: number;
    bufferMinutes: number;
    minNoticeHours: number;
    bookingWindowDays: number;
    cancellationNoticeHours: number;
  };
};

function formatDays(days: number) {
  return days === 180 ? '6 meses' : `${days} dias`;
}

function formatHours(hours: number) {
  if (hours === 24) return '24 horas (1 dia)';
  if (hours === 48) return '48 horas (2 dias)';
  return `${hours} horas`;
}

export function RulesStep({ initialValues }: RulesStepProps) {
  const [state, formAction, pending] = useActionState<Result<null> | null, FormData>(
    submitRulesStep,
    null,
  );

  const slotRef = useRef<HTMLSelectElement>(null);
  const bufferRef = useRef<HTMLSelectElement>(null);
  const noticeRef = useRef<HTMLSelectElement>(null);
  const windowRef = useRef<HTMLSelectElement>(null);
  const cancellationRef = useRef<HTMLSelectElement>(null);

  function applyRecommended() {
    if (slotRef.current) slotRef.current.value = String(RECOMMENDED_RULES.slotIntervalMinutes);
    if (bufferRef.current) bufferRef.current.value = String(RECOMMENDED_RULES.bufferMinutes);
    if (noticeRef.current) noticeRef.current.value = String(RECOMMENDED_RULES.minNoticeHours);
    if (windowRef.current) windowRef.current.value = String(RECOMMENDED_RULES.bookingWindowDays);
    if (cancellationRef.current) {
      cancellationRef.current.value = String(RECOMMENDED_RULES.cancellationNoticeHours);
    }
  }

  return (
    <form className="stack" aria-label="Regras recomendadas" action={formAction}>
      <Button type="button" onClick={applyRecommended}>
        Usar recomendações
      </Button>

      <label>
        Intervalo da agenda
        <select
          ref={slotRef}
          name="slotIntervalMinutes"
          defaultValue={initialValues.slotIntervalMinutes}
        >
          {SLOT_INTERVAL_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option} minutos
            </option>
          ))}
        </select>
      </label>
      <label>
        Intervalo entre clientes
        <select ref={bufferRef} name="bufferMinutes" defaultValue={initialValues.bufferMinutes}>
          {BUFFER_MINUTES_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option} minutos
            </option>
          ))}
        </select>
      </label>
      <label>
        Antecedência mínima para marcar
        <select ref={noticeRef} name="minNoticeHours" defaultValue={initialValues.minNoticeHours}>
          {MIN_NOTICE_HOURS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {formatHours(option)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Janela de marcação no futuro
        <select
          ref={windowRef}
          name="bookingWindowDays"
          defaultValue={initialValues.bookingWindowDays}
        >
          {BOOKING_WINDOW_DAYS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {formatDays(option)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Aviso mínimo para cancelar
        <select
          ref={cancellationRef}
          name="cancellationNoticeHours"
          defaultValue={initialValues.cancellationNoticeHours}
        >
          {CANCELLATION_NOTICE_HOURS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {formatHours(option)}
            </option>
          ))}
        </select>
      </label>

      {state && !state.ok ? (
        <p role="alert" className="form-error">
          {state.error.message}
        </p>
      ) : null}
      <div className="wizard-actions">
        <Button type="submit" formAction={goToPreviousStep} disabled={pending}>
          Voltar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'A guardar…' : 'Seguinte'}
        </Button>
      </div>
    </form>
  );
}
