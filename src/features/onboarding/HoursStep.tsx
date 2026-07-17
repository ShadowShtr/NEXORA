'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { goToPreviousStep, submitHoursStep } from '@/features/onboarding/actions';
import { DAY_LABELS, type DayHoursValue } from '@/features/onboarding/domain/hours-step';
import type { Result } from '@/lib/result';

type HoursStepProps = {
  initialDays: DayHoursValue[];
};

export function HoursStep({ initialDays }: HoursStepProps) {
  const [state, formAction, pending] = useActionState<Result<null> | null, FormData>(
    submitHoursStep,
    null,
  );
  const [openDays, setOpenDays] = useState<boolean[]>(() => initialDays.map((day) => day.isOpen));

  return (
    <form className="stack" aria-label="Horários de trabalho" action={formAction}>
      <div className="hours-list">
        {initialDays.map((day) => (
          <fieldset key={day.dayOfWeek} className="hours-day">
            <legend>{DAY_LABELS[day.dayOfWeek]}</legend>
            <label className="hours-toggle">
              <input
                type="checkbox"
                name={`day-${day.dayOfWeek}-isOpen`}
                defaultChecked={day.isOpen}
                onChange={(event) =>
                  setOpenDays((current) => {
                    const next = [...current];
                    next[day.dayOfWeek] = event.target.checked;
                    return next;
                  })
                }
              />
              Aberto
            </label>
            {openDays[day.dayOfWeek] ? (
              <div className="hours-times">
                <label>
                  Início
                  <input
                    type="time"
                    name={`day-${day.dayOfWeek}-opensAt`}
                    defaultValue={day.opensAt}
                  />
                </label>
                <label>
                  Fim
                  <input
                    type="time"
                    name={`day-${day.dayOfWeek}-closesAt`}
                    defaultValue={day.closesAt}
                  />
                </label>
                <label>
                  Almoço início (opcional)
                  <input
                    type="time"
                    name={`day-${day.dayOfWeek}-lunchStartsAt`}
                    defaultValue={day.lunchStartsAt}
                  />
                </label>
                <label>
                  Almoço fim (opcional)
                  <input
                    type="time"
                    name={`day-${day.dayOfWeek}-lunchEndsAt`}
                    defaultValue={day.lunchEndsAt}
                  />
                </label>
              </div>
            ) : null}
          </fieldset>
        ))}
      </div>
      {state && !state.ok ? (
        <p role="alert" className="form-error">
          {state.error.message}
        </p>
      ) : null}
      <div className="wizard-actions">
        {/* Server Actions can't be nested forms — a second <form> per NEX-030's
            engine — so "Voltar" overrides the action for this one button instead
            (standard HTML formaction behaviour). */}
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
