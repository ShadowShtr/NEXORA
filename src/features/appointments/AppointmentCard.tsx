import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import {
  APPOINTMENT_STATUS_LABELS,
  buildAppointmentReminderMessage,
  buildWhatsappDeepLink,
  type AppointmentCardStatus,
} from './domain/appointment-card';
import { AppointmentCompletionPanel } from './AppointmentCompletionPanel';
import type { AvailableService } from './domain/extras';

function formatEuros(cents: number) {
  return (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

const STATUS_BADGE_VARIANT: Record<
  AppointmentCardStatus,
  'info' | 'primary' | 'success' | 'danger' | 'warning'
> = {
  confirmed: 'info',
  presence_confirmed: 'primary',
  completed: 'success',
  cancelled: 'danger',
  no_show: 'warning',
};

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
// new overlay component, consistent with cancel/reschedule/mark-no-show). Layout:
// docs/DESIGN_SYSTEM_PIXEL_PERFECT.md §12 "Cartão de agenda" (grid horário/conteúdo/ações).
export function AppointmentCard({
  appointment,
  availableServices,
}: {
  appointment: AppointmentCardData;
  availableServices: AvailableService[];
}) {
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
      <div className="appointment-card-row">
        <span className="appointment-card-time">{appointment.timeLabel}</span>
        <div className="appointment-card-body">
          <p className="appointment-card-client">{appointment.clientName}</p>
          <p className="appointment-card-items">
            {appointment.itemDescriptions.length > 0
              ? `${appointment.itemDescriptions.join(', ')} · `
              : ''}
            {formatEuros(appointment.totalCents)}
          </p>
        </div>
        <div className="appointment-card-quick-actions">
          {isActive && whatsappHref ? (
            <a
              className="nx-icon-button"
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              aria-label="Abrir WhatsApp"
            >
              <MessageCircle aria-hidden="true" />
            </a>
          ) : null}
          <Badge variant={STATUS_BADGE_VARIANT[appointment.status]}>
            {APPOINTMENT_STATUS_LABELS[appointment.status]}
          </Badge>
        </div>
      </div>
      <div className="appointment-card-actions">
        <Link
          className="button button-secondary link-button"
          href={`/dashboard/agenda/${appointment.id}`}
        >
          Ver detalhes
        </Link>
        {isActive ? (
          <AppointmentCompletionPanel
            appointmentId={appointment.id}
            expectedTotalCents={appointment.totalCents}
            availableServices={availableServices}
          />
        ) : null}
      </div>
    </li>
  );
}
