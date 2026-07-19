export type AppointmentCardStatus =
  'confirmed' | 'presence_confirmed' | 'completed' | 'cancelled' | 'no_show';

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentCardStatus, string> = {
  confirmed: 'Confirmada',
  presence_confirmed: 'Presença confirmada',
  completed: 'Concluída',
  cancelled: 'Cancelada',
  no_show: 'Não compareceu',
};

// docs/02_UX_FLOWS.md, Fluxo C: "'Abrir WhatsApp' gera deep link com mensagem." wa.me
// only accepts digits, no leading "+" — E.164 stripping belongs here, the one place
// this card builds the link, rather than duplicated per call site.
export function buildWhatsappDeepLink(phoneE164: string, message: string): string {
  const digits = phoneE164.replace('+', '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function buildAppointmentReminderMessage(clientName: string, timeLabel: string): string {
  return `Olá ${clientName}! Só a confirmar a sua marcação de hoje às ${timeLabel}.`;
}
