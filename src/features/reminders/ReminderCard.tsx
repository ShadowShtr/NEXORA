'use client';

import { useActionState, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  MessageCircle,
} from 'lucide-react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { markReminderOpened, markReminderSent } from './actions';
import { REMINDER_BADGE_LABELS, type ReminderBadge } from './domain/reminder-badges';
import type { Result } from '@/lib/result';

export type ReminderCardData = {
  reminderId: string;
  appointmentId: string | null;
  clientName: string;
  dateTimeLabel: string;
  serviceLabel: string | null;
  badge: ReminderBadge;
  whatsappHref: string | null;
  sentAtLabel: string | null;
};

const STATUS_ICONS: Record<ReminderBadge, typeof Bell> = {
  overdue: AlertTriangle,
  pending: Bell,
  opened: MessageCircle,
  marked_sent: CheckCircle2,
  skipped: Bell,
};

// Visual refinement mid-2026 — Lembretes reference: a compact card with one primary
// action ("Abrir WhatsApp") and two small icon-only secondary actions, replacing the
// old three-equal-weight-buttons layout (shared .appointment-card, still used as-is by
// Agenda/Clientes/appointment-detail — untouched here, this card uses its own
// .reminder-card classes). "Marcar como enviado" now opens a confirm sheet instead of
// submitting immediately: "A NEXORA não consegue confirmar automaticamente o envio sem
// a API oficial do WhatsApp" is exactly why this needs to be a deliberate, confirmed
// action, not a stray tap.
export function ReminderCard({ reminder }: { reminder: ReminderCardData }) {
  const [sentState, sentFormAction, sentPending] = useActionState<Result<null> | null, FormData>(
    markReminderSent,
    null,
  );
  const [confirming, setConfirming] = useState(false);

  function handleWhatsappClick() {
    const formData = new FormData();
    formData.set('reminderId', reminder.reminderId);
    void markReminderOpened(null, formData);
  }

  const alreadySent = reminder.badge === 'marked_sent' || sentState?.ok === true;
  const badge = sentState?.ok ? 'marked_sent' : reminder.badge;
  const StatusIcon = STATUS_ICONS[badge];

  return (
    <li className="reminder-card" data-status={badge}>
      <span className="reminder-status-icon" aria-hidden="true">
        <StatusIcon size={20} />
      </span>

      <span className="reminder-main">
        <span className="reminder-date-time">{reminder.dateTimeLabel}</span>
        <span className="reminder-client-name">{reminder.clientName}</span>
        {reminder.serviceLabel ? (
          <span className="reminder-service">{reminder.serviceLabel}</span>
        ) : null}
        {alreadySent && reminder.sentAtLabel ? (
          <span className="reminder-sent-time">{reminder.sentAtLabel}</span>
        ) : null}
      </span>

      <span className="reminder-status-badge" data-status={badge}>
        {REMINDER_BADGE_LABELS[badge]}
      </span>

      {sentState && !sentState.ok ? (
        <p role="alert" className="form-error reminder-card-error">
          {sentState.error.message}
        </p>
      ) : null}

      <div className="reminder-card-actions">
        {reminder.whatsappHref ? (
          <a
            className="open-whatsapp-button"
            href={reminder.whatsappHref}
            target="_blank"
            rel="noreferrer"
            onClick={handleWhatsappClick}
          >
            <MessageCircle aria-hidden="true" size={19} />
            Abrir WhatsApp
          </a>
        ) : (
          <span className="open-whatsapp-button" data-disabled="true">
            Sem WhatsApp
          </span>
        )}
        {reminder.appointmentId ? (
          <a
            className="view-booking-button"
            href={`/dashboard/agenda/${reminder.appointmentId}`}
            aria-label="Ver marcação"
            title="Ver marcação"
          >
            <CalendarDays aria-hidden="true" size={19} />
          </a>
        ) : null}
        {!alreadySent ? (
          <button
            type="button"
            className="mark-sent-button"
            aria-label="Marcar como enviado"
            title="Marcar como enviado"
            onClick={() => setConfirming(true)}
          >
            <Check aria-hidden="true" size={19} />
          </button>
        ) : null}
      </div>

      {confirming ? (
        <BottomSheet
          title="Confirmar lembrete como enviado?"
          subtitle="A NEXORA não consegue confirmar automaticamente o envio sem a API oficial do WhatsApp."
          onClose={() => setConfirming(false)}
        >
          <div className="wizard-actions">
            <form
              action={(formData) => {
                sentFormAction(formData);
                setConfirming(false);
              }}
              className="logout-confirm-form"
            >
              <input type="hidden" name="reminderId" value={reminder.reminderId} />
              <Button type="submit" disabled={sentPending}>
                Confirmar envio
              </Button>
            </form>
            <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
          </div>
        </BottomSheet>
      ) : null}
    </li>
  );
}
