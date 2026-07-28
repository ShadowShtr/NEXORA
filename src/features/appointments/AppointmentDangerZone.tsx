'use client';

import { useActionState, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cancelAppointment, cancelRecurringSeries, markAppointmentNoShow } from './detail-actions';
import type { Result } from '@/lib/result';

// Visual refinement mid-2026 (Detalhes da marcação) — collapsed by default (<details>,
// no JS needed to keep it closed) instead of an always-open card the same height as
// everything else on the page, for two buttons the dona reaches for rarely. Cancel/
// no-show logic itself — including the two-step reveal-then-submit confirmation and the
// recurring-series scope choice — is unchanged from the previous AppointmentDetailActions,
// just restyled and given its own collapsible home.
//
// canCancel must gate the *buttons* here, inside the component, not whether the parent
// mounts this component at all — the page passed canCancel={isActive} and stopped
// rendering this component the moment isActive flips to false, which happens the
// instant a cancel succeeds: the parent's own revalidatePath refresh then unmounted
// this exact component before its "Marcação cancelada." success branch ever got a
// chance to render, silently swallowing the confirmation message. Always mounting it
// (page.tsx) and checking canCancel in here instead keeps this component's own
// useActionState alive across that refresh, exactly like AppointmentPrimaryActions
// already does for canReschedule.
export function AppointmentDangerZone({
  appointmentId,
  recurringSeriesId,
  canCancel,
}: {
  appointmentId: string;
  recurringSeriesId: string | null;
  canCancel: boolean;
}) {
  const [cancelState, cancelFormAction, cancelPending] = useActionState<
    Result<null> | null,
    FormData
  >(cancelAppointment, null);
  const [cancelSeriesState, cancelSeriesFormAction, cancelSeriesPending] = useActionState<
    Result<{ cancelledCount: number }> | null,
    FormData
  >(cancelRecurringSeries, null);
  const [noShowState, noShowFormAction, noShowPending] = useActionState<
    Result<null> | null,
    FormData
  >(markAppointmentNoShow, null);

  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [confirmingNoShow, setConfirmingNoShow] = useState(false);

  if (cancelState?.ok) {
    return <p role="status">Marcação cancelada.</p>;
  }
  if (cancelSeriesState?.ok) {
    return (
      <p role="status">
        {cancelSeriesState.value.cancelledCount === 1
          ? '1 marcação cancelada.'
          : `${cancelSeriesState.value.cancelledCount} marcações canceladas.`}
      </p>
    );
  }
  if (noShowState?.ok) {
    return <p role="status">Falta registada.</p>;
  }

  if (!canCancel) return null;

  return (
    <details className="booking-danger-zone">
      <summary>
        Ações delicadas
        <ChevronDown size={18} aria-hidden="true" />
      </summary>

      <div className="booking-danger-content">
        {!confirmingCancel && !confirmingNoShow ? (
          <div className="booking-danger-actions">
            <button
              type="button"
              className="booking-cancel-button"
              onClick={() => setConfirmingCancel(true)}
            >
              Cancelar marcação
            </button>
            <button
              type="button"
              className="booking-no-show-button"
              onClick={() => setConfirmingNoShow(true)}
            >
              Marcar falta
            </button>
          </div>
        ) : null}

        {confirmingCancel ? (
          recurringSeriesId ? (
            <div className="stack">
              {cancelState && !cancelState.ok ? (
                <p role="alert" className="form-error">
                  {cancelState.error.message}
                </p>
              ) : null}
              {cancelSeriesState && !cancelSeriesState.ok ? (
                <p role="alert" className="form-error">
                  {cancelSeriesState.error.message}
                </p>
              ) : null}
              <p>Esta marcação faz parte de uma série recorrente. O que quer cancelar?</p>
              <form action={cancelFormAction}>
                <input type="hidden" name="appointmentId" value={appointmentId} />
                <Button type="submit" variant="secondary" disabled={cancelPending}>
                  {cancelPending ? 'A cancelar…' : 'Só esta marcação'}
                </Button>
              </form>
              <form action={cancelSeriesFormAction}>
                <input type="hidden" name="appointmentId" value={appointmentId} />
                <input type="hidden" name="scope" value="this_and_future" />
                <Button type="submit" variant="secondary" disabled={cancelSeriesPending}>
                  {cancelSeriesPending ? 'A cancelar…' : 'Esta e as próximas'}
                </Button>
              </form>
              <form action={cancelSeriesFormAction}>
                <input type="hidden" name="appointmentId" value={appointmentId} />
                <input type="hidden" name="scope" value="all" />
                <Button type="submit" variant="secondary" disabled={cancelSeriesPending}>
                  {cancelSeriesPending ? 'A cancelar…' : 'Toda a série'}
                </Button>
              </form>
              <Button type="button" variant="secondary" onClick={() => setConfirmingCancel(false)}>
                Voltar
              </Button>
            </div>
          ) : (
            <form action={cancelFormAction} className="stack">
              <input type="hidden" name="appointmentId" value={appointmentId} />
              {cancelState && !cancelState.ok ? (
                <p role="alert" className="form-error">
                  {cancelState.error.message}
                </p>
              ) : null}
              <p>Cancelar esta marcação?</p>
              <p className="text-support">
                O horário voltará a ficar disponível. A cliente não será avisada automaticamente
                pelo WhatsApp.
              </p>
              <div className="wizard-actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setConfirmingCancel(false)}
                >
                  Voltar
                </Button>
                <Button type="submit" disabled={cancelPending}>
                  {cancelPending ? 'A cancelar…' : 'Cancelar marcação'}
                </Button>
              </div>
            </form>
          )
        ) : null}

        {confirmingNoShow ? (
          <form action={noShowFormAction} className="stack">
            <input type="hidden" name="appointmentId" value={appointmentId} />
            {noShowState && !noShowState.ok ? (
              <p role="alert" className="form-error">
                {noShowState.error.message}
              </p>
            ) : null}
            <p>Marcar esta cliente como falta?</p>
            <p className="text-support">A ausência ficará registada no histórico da cliente.</p>
            <div className="wizard-actions">
              <Button type="button" variant="secondary" onClick={() => setConfirmingNoShow(false)}>
                Voltar
              </Button>
              <Button type="submit" disabled={noShowPending}>
                {noShowPending ? 'A registar…' : 'Marcar falta'}
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </details>
  );
}
