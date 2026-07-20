'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { markReminderOpened, markReminderSent } from './actions';
import { REMINDER_BADGE_LABELS, type ReminderBadge } from './domain/reminder-badges';
import type { Result } from '@/lib/result';

export type ReminderCardData = {
  reminderId: string;
  appointmentId: string | null;
  clientName: string;
  timeLabel: string;
  badge: ReminderBadge;
  whatsappHref: string | null;
};

// NEX-103: "Registar aberto e marcado enviado" without ever claiming delivery/read
// (docs/01_PRODUCT_REQUIREMENTS.md §8). "Abrir WhatsApp" fires markReminderOpened
// (fire-and-forget — the link's own navigation is what matters to the dona, a failed
// audit write shouldn't block her from opening WhatsApp) before the browser follows the
// href; "Marcar como enviado" is a separate, explicit action, because opening the chat
// is not the same fact as actually having sent the message.
export function ReminderCard({ reminder }: { reminder: ReminderCardData }) {
  const [sentState, sentFormAction, sentPending] = useActionState<Result<null> | null, FormData>(
    markReminderSent,
    null,
  );

  function handleWhatsappClick() {
    const formData = new FormData();
    formData.set('reminderId', reminder.reminderId);
    void markReminderOpened(null, formData);
  }

  const alreadySent = reminder.badge === 'marked_sent' || sentState?.ok;

  return (
    <li className={`appointment-card appointment-card-${reminder.badge}`}>
      <div className="appointment-card-header">
        <span className="appointment-card-time">{reminder.timeLabel}</span>
        <span className="appointment-card-status">
          {sentState?.ok
            ? REMINDER_BADGE_LABELS.marked_sent
            : REMINDER_BADGE_LABELS[reminder.badge]}
        </span>
      </div>
      <p className="appointment-card-client">{reminder.clientName}</p>
      {sentState && !sentState.ok ? (
        <p role="alert" className="form-error">
          {sentState.error.message}
        </p>
      ) : null}
      <div className="appointment-card-actions">
        {reminder.appointmentId ? (
          <a
            className="button button-secondary link-button"
            href={`/dashboard/agenda/${reminder.appointmentId}`}
          >
            Ver marcação
          </a>
        ) : null}
        {reminder.whatsappHref ? (
          <a
            className="button button-secondary link-button"
            href={reminder.whatsappHref}
            target="_blank"
            rel="noreferrer"
            onClick={handleWhatsappClick}
          >
            Abrir WhatsApp
          </a>
        ) : null}
        {!alreadySent ? (
          <form action={sentFormAction}>
            <input type="hidden" name="reminderId" value={reminder.reminderId} />
            <Button type="submit" variant="secondary" disabled={sentPending}>
              {sentPending ? 'A guardar…' : 'Marcar como enviado'}
            </Button>
          </form>
        ) : null}
      </div>
    </li>
  );
}
