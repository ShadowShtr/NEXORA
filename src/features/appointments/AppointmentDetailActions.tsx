'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cancelAppointment, markAppointmentNoShow, rescheduleAppointment } from './detail-actions';
import type { Result } from '@/lib/result';

// NEX-084: "Ações internas com confirmação e auditoria" — confirmation is a two-step
// reveal (click "Cancelar"/"Reagendar" once to show the real action, click again to
// commit) rather than a native window.confirm(), consistent with the rest of this
// codebase never using browser-native dialogs. Auditoria itself is written by the RPCs
// these actions call (0008_cancel_reschedule_appointment.sql), not by this component.
export function AppointmentDetailActions({
  appointmentId,
  canCancel,
  canReschedule,
}: {
  appointmentId: string;
  canCancel: boolean;
  canReschedule: boolean;
}) {
  const [cancelState, cancelFormAction, cancelPending] = useActionState<
    Result<null> | null,
    FormData
  >(cancelAppointment, null);
  const [rescheduleState, rescheduleFormAction, reschedulePending] = useActionState<
    Result<null> | null,
    FormData
  >(rescheduleAppointment, null);
  const [noShowState, noShowFormAction, noShowPending] = useActionState<
    Result<null> | null,
    FormData
  >(markAppointmentNoShow, null);

  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [confirmingNoShow, setConfirmingNoShow] = useState(false);
  const [showRescheduleForm, setShowRescheduleForm] = useState(false);

  const error = [cancelState, rescheduleState, noShowState].find(
    (state): state is Extract<Result<null>, { ok: false }> => state !== null && !state.ok,
  );

  if (cancelState?.ok) {
    return <p role="status">Marcação cancelada.</p>;
  }
  if (rescheduleState?.ok) {
    return <p role="status">Marcação reagendada.</p>;
  }
  if (noShowState?.ok) {
    return <p role="status">Falta registada.</p>;
  }

  return (
    <div className="stack">
      {error ? (
        <p role="alert" className="form-error">
          {error.error.message}
        </p>
      ) : null}

      {canReschedule ? (
        <div>
          {!showRescheduleForm ? (
            <Button type="button" variant="secondary" onClick={() => setShowRescheduleForm(true)}>
              Reagendar
            </Button>
          ) : (
            <form action={rescheduleFormAction} className="stack">
              <input type="hidden" name="appointmentId" value={appointmentId} />
              <label>
                Novo horário
                <input type="datetime-local" name="newStartAtIso" required />
              </label>
              <div className="wizard-actions">
                <Button type="submit" disabled={reschedulePending}>
                  {reschedulePending ? 'A reagendar…' : 'Confirmar novo horário'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowRescheduleForm(false)}
                >
                  Cancelar edição
                </Button>
              </div>
            </form>
          )}
        </div>
      ) : null}

      {canCancel ? (
        <div>
          {!confirmingCancel ? (
            <Button type="button" variant="secondary" onClick={() => setConfirmingCancel(true)}>
              Cancelar marcação
            </Button>
          ) : (
            <form action={cancelFormAction} className="wizard-actions">
              <input type="hidden" name="appointmentId" value={appointmentId} />
              <p>Tem a certeza que quer cancelar esta marcação?</p>
              <Button type="submit" disabled={cancelPending}>
                {cancelPending ? 'A cancelar…' : 'Sim, cancelar'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setConfirmingCancel(false)}>
                Voltar
              </Button>
            </form>
          )}
        </div>
      ) : null}

      {canCancel ? (
        <div>
          {!confirmingNoShow ? (
            <Button type="button" variant="secondary" onClick={() => setConfirmingNoShow(true)}>
              Marcar falta
            </Button>
          ) : (
            <form action={noShowFormAction} className="wizard-actions">
              <input type="hidden" name="appointmentId" value={appointmentId} />
              <p>Confirma que a cliente não compareceu a esta marcação?</p>
              <Button type="submit" disabled={noShowPending}>
                {noShowPending ? 'A registar…' : 'Sim, marcar falta'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setConfirmingNoShow(false)}>
                Voltar
              </Button>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}
