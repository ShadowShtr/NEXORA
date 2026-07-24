'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import {
  cancelAppointment,
  cancelRecurringSeries,
  markAppointmentNoShow,
  reopenAppointment,
  rescheduleAppointment,
} from './detail-actions';
import type { Result } from '@/lib/result';

// NEX-084: "Ações internas com confirmação e auditoria" — confirmation is a two-step
// reveal (click "Cancelar"/"Reagendar" once to show the real action, click again to
// commit) rather than a native window.confirm(), consistent with the rest of this
// codebase never using browser-native dialogs. Auditoria itself is written by the RPCs
// these actions call (0008_cancel_reschedule_appointment.sql, NEX-115's
// 0031_reopen_appointment.sql), not by this component.
//
// Cancelar/Marcar falta are destructive and irreversible from here — grouped in their
// own "zona de risco" block, visually separated from Reagendar (routine) and from the
// completed-appointment actions below, so a rushed tap can't land on them by proximity.
export function AppointmentDetailActions({
  appointmentId,
  clientId,
  recurringSeriesId,
  canCancel,
  canReschedule,
  canReopen,
}: {
  appointmentId: string;
  clientId: string | null;
  recurringSeriesId: string | null;
  canCancel: boolean;
  canReschedule: boolean;
  canReopen: boolean;
}) {
  const [cancelState, cancelFormAction, cancelPending] = useActionState<
    Result<null> | null,
    FormData
  >(cancelAppointment, null);
  const [cancelSeriesState, cancelSeriesFormAction, cancelSeriesPending] = useActionState<
    Result<{ cancelledCount: number }> | null,
    FormData
  >(cancelRecurringSeries, null);
  const [rescheduleState, rescheduleFormAction, reschedulePending] = useActionState<
    Result<null> | null,
    FormData
  >(rescheduleAppointment, null);
  const [noShowState, noShowFormAction, noShowPending] = useActionState<
    Result<null> | null,
    FormData
  >(markAppointmentNoShow, null);
  const [reopenState, reopenFormAction, reopenPending] = useActionState<
    Result<null> | null,
    FormData
  >(reopenAppointment, null);

  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [confirmingNoShow, setConfirmingNoShow] = useState(false);
  const [confirmingReopen, setConfirmingReopen] = useState(false);
  const [showRescheduleForm, setShowRescheduleForm] = useState(false);

  const error = [cancelState, rescheduleState, noShowState, reopenState, cancelSeriesState].find(
    (state): state is Extract<Result<unknown>, { ok: false }> => state !== null && !state.ok,
  );

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
  if (rescheduleState?.ok) {
    return <p role="status">Marcação reagendada.</p>;
  }
  if (noShowState?.ok) {
    return <p role="status">Falta registada.</p>;
  }
  if (reopenState?.ok) {
    return <p role="status">Marcação reaberta. Pode corrigir e concluir novamente.</p>;
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

      {canReopen ? (
        <div className="stack">
          {clientId ? (
            <Link
              href={`/dashboard/agenda/nova?clientId=${clientId}`}
              className="button button-secondary"
            >
              Duplicar marcação
            </Link>
          ) : null}
          <Link href="/dashboard/financeiro/pendentes" className="button button-secondary">
            Ver pagamentos pendentes
          </Link>
          {!confirmingReopen ? (
            <Button type="button" variant="secondary" onClick={() => setConfirmingReopen(true)}>
              Reabrir marcação
            </Button>
          ) : (
            <form action={reopenFormAction} className="wizard-actions">
              <input type="hidden" name="appointmentId" value={appointmentId} />
              <p>
                Reabrir remove extras/descontos aplicados no fecho e marca o pagamento como
                estornado. Poderá corrigir e concluir novamente.
              </p>
              <Button type="submit" disabled={reopenPending}>
                {reopenPending ? 'A reabrir…' : 'Sim, reabrir'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setConfirmingReopen(false)}>
                Voltar
              </Button>
            </form>
          )}
        </div>
      ) : null}

      {canCancel ? (
        <div className="appointment-danger-zone">
          <p className="appointment-danger-zone-label">Zona de risco</p>
          <div>
            {!confirmingCancel ? (
              <Button type="button" variant="secondary" onClick={() => setConfirmingCancel(true)}>
                Cancelar marcação
              </Button>
            ) : recurringSeriesId ? (
              <div className="stack">
                <p>Esta marcação faz parte de uma série recorrente. O que quer cancelar?</p>
                <form action={cancelFormAction} className="wizard-actions">
                  <input type="hidden" name="appointmentId" value={appointmentId} />
                  <Button type="submit" disabled={cancelPending}>
                    {cancelPending ? 'A cancelar…' : 'Só esta marcação'}
                  </Button>
                </form>
                <form action={cancelSeriesFormAction} className="wizard-actions">
                  <input type="hidden" name="appointmentId" value={appointmentId} />
                  <input type="hidden" name="scope" value="this_and_future" />
                  <Button type="submit" disabled={cancelSeriesPending}>
                    {cancelSeriesPending ? 'A cancelar…' : 'Esta e as próximas'}
                  </Button>
                </form>
                <form action={cancelSeriesFormAction} className="wizard-actions">
                  <input type="hidden" name="appointmentId" value={appointmentId} />
                  <input type="hidden" name="scope" value="all" />
                  <Button type="submit" disabled={cancelSeriesPending}>
                    {cancelSeriesPending ? 'A cancelar…' : 'Toda a série'}
                  </Button>
                </form>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setConfirmingCancel(false)}
                >
                  Voltar
                </Button>
              </div>
            ) : (
              <form action={cancelFormAction} className="wizard-actions">
                <input type="hidden" name="appointmentId" value={appointmentId} />
                <p>Tem a certeza que quer cancelar esta marcação?</p>
                <Button type="submit" disabled={cancelPending}>
                  {cancelPending ? 'A cancelar…' : 'Sim, cancelar'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setConfirmingCancel(false)}
                >
                  Voltar
                </Button>
              </form>
            )}
          </div>

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
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setConfirmingNoShow(false)}
                >
                  Voltar
                </Button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
