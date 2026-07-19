// NEX-101: "Pendentes, overdue e concluídos com badges." reminder_status
// (0001_initial.sql) already distinguishes pending/opened/marked_sent/skipped at the
// data layer; "overdue" is a derived view over 'pending' rows whose due_at has passed,
// not a fifth database status — a lembrete pending que passou do due_at is still
// something the dona needs to act on, it just needs a more urgent badge.
export type ReminderBadge = 'overdue' | 'pending' | 'opened' | 'marked_sent' | 'skipped';

export const REMINDER_BADGE_LABELS: Record<ReminderBadge, string> = {
  overdue: 'Atrasado',
  pending: 'Pendente',
  opened: 'WhatsApp aberto',
  marked_sent: 'Enviado',
  skipped: 'Ignorado',
};

export function resolveReminderBadge(
  status: 'pending' | 'opened' | 'marked_sent' | 'skipped',
  dueAtMs: number,
  nowMs: number = Date.now(),
): ReminderBadge {
  if (status === 'pending' && dueAtMs <= nowMs) return 'overdue';
  return status;
}
