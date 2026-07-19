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

// NEX-102: the dashboard's "hoje" card (buildAppointmentReminderMessage above) only
// ever shows same-day appointments, so hardcoding "hoje" is correct there — but the
// reminders list (NEX-101) can show a reminder for tomorrow or later, where "hoje"
// would be wrong. dateLabel is a short pt-PT day label (e.g. "amanhã" or "sexta,
// 24/07"), left to the caller to compute from its own timezone-aware formatting.
export function buildReminderWhatsappMessage(
  clientName: string,
  dateLabel: string,
  timeLabel: string,
): string {
  return `Olá ${clientName}! Só a confirmar a sua marcação de ${dateLabel} às ${timeLabel}.`;
}
