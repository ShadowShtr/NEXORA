import { Button } from '@/components/ui/Button';
import {
  APPOINTMENT_STATUS_LABELS,
  buildAppointmentReminderMessage,
  buildWhatsappDeepLink,
  type AppointmentCardStatus,
} from './domain/appointment-card';

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

// NEX-081: "Cartões mostram atendimentos por hora" (docs/02_UX_FLOWS.md, Fluxo C) —
// horário, cliente, itens, valor, estado, e the two quick actions the flow calls for:
// "Abrir WhatsApp" (a real deep link, functional today) and "Concluir" (Fluxo C: "abre
// modal rápido" — the actual completion flow is NEX-110/113, EPIC-11, not yet built;
// shown here disabled with an explanatory title rather than omitted, so the card's
// final shape is already visible and NEX-110 only has to wire behavior, not add UI).
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
      {isActive ? (
        <div className="appointment-card-actions">
          {whatsappHref ? (
            <a
              className="button button-secondary link-button"
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
            >
              Abrir WhatsApp
            </a>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            disabled
            title="Disponível em breve — conclusão e pagamento chegam numa próxima atualização."
          >
            Concluir
          </Button>
        </div>
      ) : null}
    </li>
  );
}
