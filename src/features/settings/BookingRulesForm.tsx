'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { HelpTip } from '@/components/ui/HelpTip';
import { updateBookingRules } from './booking-rules-actions';
import {
  BOOKING_WINDOW_DAYS_OPTIONS,
  BUFFER_MINUTES_OPTIONS,
  CANCELLATION_NOTICE_HOURS_OPTIONS,
  MIN_NOTICE_HOURS_OPTIONS,
  RECOMMENDED_RULES,
  SLOT_INTERVAL_OPTIONS,
} from '@/features/onboarding/domain/rules-step';
import type { Result } from '@/lib/result';

type Rules = {
  slotIntervalMinutes: number;
  bufferMinutes: number;
  minNoticeHours: number;
  bookingWindowDays: number;
  cancellationNoticeHours: number;
};

function formatDays(days: number) {
  return days === 180 ? '6 meses' : `${days} dias`;
}

function formatHours(hours: number) {
  if (hours === 24) return '24 horas (1 dia)';
  if (hours === 48) return '48 horas (2 dias)';
  return `${hours} horas`;
}

// NEX-141: "Defaults e 'usar recomendações' — configuração rápida sem termos técnicos."
// Same 5 rules and same labels as the onboarding wizard's RulesStep (NEX-034), made
// editable afterward. "Usar recomendações" here is a real reset — not a page reload
// away from being undone like on the wizard (there's no wizard step to just navigate
// back from) — so it remembers the values from just before the reset and offers
// "Desfazer" to restore them, both purely client-side until "Guardar" is pressed.
export function BookingRulesForm({ initialValues }: { initialValues: Rules }) {
  const [state, formAction, pending] = useActionState<Result<null> | null, FormData>(
    updateBookingRules,
    null,
  );
  const [values, setValues] = useState<Rules>(initialValues);
  const [beforeReset, setBeforeReset] = useState<Rules | null>(null);

  function applyRecommended() {
    setBeforeReset(values);
    setValues(RECOMMENDED_RULES);
  }

  function undoReset() {
    if (!beforeReset) return;
    setValues(beforeReset);
    setBeforeReset(null);
  }

  function field<K extends keyof Rules>(key: K) {
    return {
      value: values[key],
      onChange: (event: React.ChangeEvent<HTMLSelectElement>) =>
        setValues((current) => ({ ...current, [key]: Number(event.target.value) })),
    };
  }

  return (
    <form className="stack" action={formAction}>
      <div className="wizard-actions">
        <Button type="button" variant="secondary" onClick={applyRecommended}>
          Usar recomendações
        </Button>
        {beforeReset ? (
          <Button type="button" variant="secondary" onClick={undoReset}>
            Desfazer
          </Button>
        ) : null}
      </div>

      <label>
        <span className="field-label-row">
          Intervalo da agenda
          <HelpTip
            label="O que é o intervalo da agenda?"
            text="Espaçamento entre os horários que aparecem disponíveis para marcar. Com 15 minutos, os horários aparecem de 15 em 15 minutos; com 60, só às horas certas."
          />
        </span>
        <select name="slotIntervalMinutes" {...field('slotIntervalMinutes')}>
          {SLOT_INTERVAL_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option} minutos
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="field-label-row">
          Intervalo entre clientes
          <HelpTip
            label="O que é o intervalo entre clientes?"
            text="Tempo livre reservado automaticamente depois de cada marcação, antes de a cliente seguinte poder marcar — para arrumar ou preparar o espaço."
          />
        </span>
        <select name="bufferMinutes" {...field('bufferMinutes')}>
          {BUFFER_MINUTES_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option} minutos
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="field-label-row">
          Antecedência mínima para marcar
          <HelpTip
            label="O que é a antecedência mínima para marcar?"
            text="Quanto tempo antes do horário uma cliente ainda consegue marcar. Com 3 horas, por exemplo, deixa de ser possível marcar para daqui a 1 hora."
          />
        </span>
        <select name="minNoticeHours" {...field('minNoticeHours')}>
          {MIN_NOTICE_HOURS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {formatHours(option)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="field-label-row">
          Janela de marcação no futuro
          <HelpTip
            label="O que é a janela de marcação no futuro?"
            text="Até quantos dias à frente uma cliente pode marcar. Depois desse limite, os horários mais distantes deixam de aparecer disponíveis na página pública."
          />
        </span>
        <select name="bookingWindowDays" {...field('bookingWindowDays')}>
          {BOOKING_WINDOW_DAYS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {formatDays(option)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="field-label-row">
          Aviso mínimo para cancelar
          <HelpTip
            label="O que é o aviso mínimo para cancelar?"
            text="Tempo mínimo de antecedência recomendado para uma cliente avisar que vai cancelar ou remarcar, antes do horário combinado."
          />
        </span>
        <select name="cancellationNoticeHours" {...field('cancellationNoticeHours')}>
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
      {state?.ok ? <p role="status">Guardado.</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'A guardar…' : 'Guardar'}
      </Button>
    </form>
  );
}
