'use client';

import { useActionState, useEffect, useState } from 'react';
import { CalendarClock, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { rescheduleAppointment } from './detail-actions';
import { getManualBookingAvailability } from './manual-availability-actions';
import { AvailabilityCalendar } from './AvailabilityCalendar';
import type { Result } from '@/lib/result';

// Visual refinement mid-2026 (Detalhes da marcação) — "Reagendar" and "WhatsApp" grouped
// as the two primary actions (spec: "o botão Reagendar não pode ficar sozinho"), instead
// of Reagendar sitting alone above an unrelated danger zone.
//
// Reagendar now picks from real computed availability (AvailabilityCalendar, the same
// widget the Nova marcação wizard and the public booking page use) instead of a blind
// <input type="datetime-local">. Two real, pre-existing bugs that blind input had (found
// while restyling, not introduced by this redesign — tests/e2e/appointment-detail.spec.ts's
// reschedule test has been failing since NEX-084's original commit, never caught because
// e2e specs don't run in this repo's CI) are both gone as a side effect of this change,
// not patched around: datetime-local hands back a bare "2026-07-31T10:51" (no seconds, no
// offset) that rescheduleSchema's z.iso.datetime() always rejected, and even a schema fix
// would still have been wrong — that string is a wall-clock reading with no timezone
// attached, and CLAUDE.md is explicit ("Não use datas locais ambíguas"). A slot picked
// from getManualBookingAvailability is already a real, correct UTC instant computed
// server-side in the tenant's own business timezone — nothing to convert.
export function AppointmentPrimaryActions({
  appointmentId,
  timezone,
  totalMinutes,
  canReschedule,
  whatsappHref,
}: {
  appointmentId: string;
  timezone: string;
  totalMinutes: number;
  canReschedule: boolean;
  whatsappHref: string | null;
}) {
  const [rescheduleState, rescheduleFormAction, reschedulePending] = useActionState<
    Result<null> | null,
    FormData
  >(rescheduleAppointment, null);
  const [showRescheduleForm, setShowRescheduleForm] = useState(false);
  const [selectedSlotIso, setSelectedSlotIso] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  useEffect(() => {
    if (!showRescheduleForm) return;
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (cancelled) return;
      setSlots(null);
      setSlotsError(null);
      void (async () => {
        const result = await getManualBookingAvailability(totalMinutes);
        if (cancelled) return;
        if (!result.ok) {
          setSlotsError('Não foi possível carregar os horários disponíveis.');
          return;
        }
        setSlots(result.value.slotsIso);
      })();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [showRescheduleForm, totalMinutes]);

  if (rescheduleState?.ok) {
    return <p role="status">Marcação reagendada.</p>;
  }

  if (showRescheduleForm) {
    return (
      <form action={rescheduleFormAction} className="stack">
        <input type="hidden" name="appointmentId" value={appointmentId} />
        <input type="hidden" name="newStartAtIso" value={selectedSlotIso ?? ''} />
        {rescheduleState && !rescheduleState.ok ? (
          <p role="alert" className="form-error">
            {rescheduleState.error.message}
          </p>
        ) : null}
        <p className="form-label">Novo horário</p>
        <AvailabilityCalendar
          totalMinutes={totalMinutes}
          timezone={timezone}
          slots={slots}
          slotsError={slotsError}
          selectedSlotIso={selectedSlotIso}
          onSelectSlot={setSelectedSlotIso}
        />
        <div className="wizard-actions">
          <Button type="button" variant="secondary" onClick={() => setShowRescheduleForm(false)}>
            Cancelar edição
          </Button>
          <Button type="submit" disabled={reschedulePending || !selectedSlotIso}>
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
