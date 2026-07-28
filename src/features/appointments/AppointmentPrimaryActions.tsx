'use client';

import { useActionState, useState } from 'react';
import { fromZonedTime } from 'date-fns-tz';
import { CalendarClock, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { rescheduleAppointment } from './detail-actions';
import type { Result } from '@/lib/result';

// Visual refinement mid-2026 (Detalhes da marcação) — "Reagendar" and "WhatsApp" grouped
// as the two primary actions (spec: "o botão Reagendar não pode ficar sozinho"), instead
// of Reagendar sitting alone above an unrelated danger zone.
//
// Pre-existing bug fixed here (found while restyling, not something the redesign
// introduced — tests/e2e/appointment-detail.spec.ts's reschedule test has been failing
// since NEX-084's original commit, never caught because e2e specs don't run in this
// repo's CI): <input type="datetime-local"> hands back a bare "2026-07-31T10:51", no
// seconds, no offset — rescheduleSchema's z.iso.datetime() (detail-actions.ts) rejects
// that shape outright. Even patching the schema to accept it would still be wrong:
// that string is a wall-clock reading with no timezone attached, and CLAUDE.md is
// explicit ("Não use datas locais ambíguas") — it must be read as the tenant's own
// business timezone (the dona is picking "this appointment's new time", not "my
// browser's current locale"), not the visitor's browser locale or a blind UTC guess.
// Converted client-side via fromZonedTime (the same primitive
// generateRecurrenceOccurrences already relies on for the identical problem) into a
// real UTC instant before it ever reaches the server action.
export function AppointmentPrimaryActions({
  appointmentId,
  timezone,
  canReschedule,
  whatsappHref,
}: {
  appointmentId: string;
  timezone: string;
  canReschedule: boolean;
  whatsappHref: string | null;
}) {
  const [rescheduleState, rescheduleFormAction, reschedulePending] = useActionState<
    Result<null> | null,
    FormData
  >(rescheduleAppointment, null);
  const [showRescheduleForm, setShowRescheduleForm] = useState(false);
  const [newStartAtLocal, setNewStartAtLocal] = useState('');

  const newStartAtIso = newStartAtLocal
    ? fromZonedTime(newStartAtLocal, timezone).toISOString()
    : '';

  if (rescheduleState?.ok) {
    return <p role="status">Marcação reagendada.</p>;
  }

  if (showRescheduleForm) {
    return (
      <form action={rescheduleFormAction} className="stack">
        <input type="hidden" name="appointmentId" value={appointmentId} />
        <input type="hidden" name="newStartAtIso" value={newStartAtIso} />
        {rescheduleState && !rescheduleState.ok ? (
          <p role="alert" className="form-error">
            {rescheduleState.error.message}
          </p>
        ) : null}
        <label className="form-field">
          <span className="form-label">Novo horário</span>
          <input
            type="datetime-local"
            required
            className="form-input"
            value={newStartAtLocal}
            onChange={(event) => setNewStartAtLocal(event.target.value)}
          />
        </label>
        <div className="wizard-actions">
          <Button type="button" variant="secondary" onClick={() => setShowRescheduleForm(false)}>
            Cancelar edição
          </Button>
          <Button type="submit" disabled={reschedulePending || !newStartAtIso}>
            {reschedulePending ? 'A reagendar…' : 'Confirmar novo horário'}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="booking-primary-actions">
      {canReschedule ? (
        <button
          type="button"
          className="booking-reschedule-button"
          onClick={() => setShowRescheduleForm(true)}
        >
          <CalendarClock size={18} aria-hidden="true" />
          Reagendar
        </button>
      ) : null}
      {whatsappHref ? (
        <a href={whatsappHref} target="_blank" rel="noreferrer" className="booking-contact-button">
          <MessageCircle size={18} aria-hidden="true" />
          WhatsApp
        </a>
      ) : null}
    </div>
  );
}
