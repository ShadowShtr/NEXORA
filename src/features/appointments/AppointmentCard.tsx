'use client';

import Link from 'next/link';
import { Check, MessageCircle } from 'lucide-react';
import {
  APPOINTMENT_STATUS_LABELS,
  buildAppointmentReminderMessage,
  buildWhatsappDeepLink,
  type AppointmentCardStatus,
} from './domain/appointment-card';
import { useOpenCompletionSheet } from './AgendaCompletionContext';

export type AppointmentCardData = {
  id: string;
  timeLabel: string;
  startAtMs: number;
  clientName: string;
  clientPhoneE164: string | null;
  itemDescriptions: string[];
  totalCents: number;
  status: AppointmentCardStatus;
};

// NEX-081/NEX-110: "Cartões mostram atendimentos por hora" (docs/02_UX_FLOWS.md, Fluxo
// C) — horário, cliente, itens, estado. Visual refinement mid-2026: a compact timeline
// row (hora + ponto + linha, ligando visualmente a um atendimento ao seguinte) instead
// of a card stacking three separate buttons — "Ver detalhes" is now the client
// name/items text itself (still /dashboard/agenda/[id], where cancelar/reagendar
// already live — AppointmentDetailActions.tsx), and only ONE quick action shows per
// row, opening the shared completion sheet (AgendaCompletionContext.tsx) rather than
// expanding the card itself — a card growing to show the full completion form was the
// single biggest visual problem with the previous layout. Which action shows depends on
// whether the appointment has actually started yet (nowMs >= startAtMs), not just its
// status: an owner reaching for "Concluir" hours before an appointment even begins would
// be a mistake waiting to happen, so a still-upcoming confirmed appointment gets
// WhatsApp (contact/remind) same as before it started, and only flips to the completion
// trigger once it's actually due.
export function AppointmentCard({
  appointment,
  nowMs,
}: {
  appointment: AppointmentCardData;
  nowMs: number;
}) {
  const openCompletionSheet = useOpenCompletionSheet();
  const isActive =
    appointment.status === 'confirmed' || appointment.status === 'presence_confirmed';
  const isDue = isActive && appointment.startAtMs <= nowMs;
  const whatsappHref = appointment.clientPhoneE164
    ? buildWhatsappDeepLink(
        appointment.clientPhoneE164,
        buildAppointmentReminderMessage(appointment.clientName, appointment.timeLabel),
      )
    : null;

  return (
    <li className="appointment-timeline-row">
      <span className="appointment-timeline-time">{appointment.timeLabel}</span>
      <span className="appointment-timeline-axis" aria-hidden="true">
        <span className="appointment-timeline-dot" />
      </span>
      <div
        className={`appointment-timeline-card appointment-card-${appointment.status}${isDue ? ' appointment-timeline-card-due' : ''}`}
      >
        <Link href={`/dashboard/agenda/${appointment.id}`} className="appointment-timeline-link">
          <span className="appointment-card-client">{appointment.clientName}</span>
          {appointment.itemDescriptions.length > 0 ? (
            <span className="appointment-card-items">
              {appointment.itemDescriptions.join(', ')}
            </span>
          ) : null}
          {!isActive ? (
            <span className="appointment-timeline-status">
              {APPOINTMENT_STATUS_LABELS[appointment.status]}
            </span>
          ) : null}
        </Link>
        <span className="appointment-timeline-action">
          {isDue ? (
            <button
              type="button"
              className="appointment-timeline-complete-trigger"
              onClick={() =>
                openCompletionSheet({
                  appointmentId: appointment.id,
                  clientName: appointment.clientName,
                  expectedTotalCents: appointment.totalCents,
                })
              }
              aria-label={`Concluir atendimento de ${appointment.clientName}`}
            >
              <Check size={16} aria-hidden="true" />
            </button>
          ) : whatsappHref ? (
            <a
              className="appointment-timeline-whatsapp"
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              aria-label="Abrir WhatsApp"
            >
              <MessageCircle size={18} aria-hidden="true" />
            </a>
          ) : null}
        </span>
      </div>
    </li>
  );
}
