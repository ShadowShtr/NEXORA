import {
  APPOINTMENT_STATUS_LABELS,
  buildAppointmentReminderMessage,
  buildWhatsappDeepLink,
  type AppointmentCardStatus,
} from './domain/appointment-card';
import { AppointmentCompletionPanel } from './AppointmentCompletionPanel';

function formatEuros(cents: number) {
  return (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

export type AppointmentCardData = {
  id: string;
  timeLabel: string;
  clientName: string;
  clientPhoneE164: string | null;
  itemDescriptions: string[];
  totalCents: number;
  status: AppointmentCardStatus;
};

// NEX-081/NEX-110: "Cartões mostram atendimentos por hora" (docs/02_UX_FLOWS.md, Fluxo
// C) — horário, cliente, itens, valor, estado, e the two quick actions the flow calls
// for: "Abrir WhatsApp" (a real deep link) and "Concluir" (Fluxo C: "abre modal
// rápido" — AppointmentCompletionPanel, an inline reveal-in-place panel rather than a
// new overlay component, consistent with cancel/reschedule/mark-no-show).
export function AppointmentCard({ appointment }: { appointment: AppointmentCardData }) {
  const isActive =
    appointment.status === 'confirmed' || appointment.status === 'presence_confirmed';
  const whatsappHref = appointment.clientPhoneE164
    ? buildWhatsappDeepLink(
        appointment.clientPhoneE164,
        buildAppointmentReminderMessage(appointment.clientName, appointment.timeLabel),
      )
    : null;

  return (
    <li className={`appointment-card appointment-card-${appointment.status}`}>
      <div className="appointment-card-header">
        <span className="appointment-card-time">{appointment.timeLabel}</span>
        <span className="appointment-card-status">
          {APPOINTMENT_STATUS_LABELS[appointment.status]}
        </span>
      </div>
      <p className="appointment-card-client">{appointment.clientName}</p>
      {appointment.itemDescriptions.length > 0 ? (
        <p className="appointment-card-items">{appointment.itemDescriptions.join(', ')}</p>
      ) : null}
      <p className="appointment-card-total">{formatEuros(appointment.totalCents)}</p>
      <div className="appointment-card-actions">
        <a
          className="button button-secondary link-button"
          href={`/dashboard/agenda/${appointment.id}`}
        >
          Ver detalhes
        </a>
        {isActive && whatsappHref ? (
          <a
            className="button button-secondary link-button"
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
          >
            Abrir WhatsApp
          </a>
        ) : null}
        {isActive ? (
          <AppointmentCompletionPanel
            appointmentId={appointment.id}
            expectedTotalCents={appointment.totalCents}
          />
        ) : null}
      </div>
    </li>
  );
}
