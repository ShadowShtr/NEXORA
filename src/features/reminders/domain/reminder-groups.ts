import { formatInTimeZone } from 'date-fns-tz';
import type { ReminderBadge } from './reminder-badges';

// Visual refinement mid-2026 — Lembretes reference: "Não deve ser apenas uma lista.
// Deve ser uma fila inteligente de ações organizadas por prioridade." "late" reuses the
// existing 'overdue' badge (reminder-badges.ts) rather than inventing a second concept
// for the same thing; the other four groups split the remaining reminders by the
// underlying appointment's own calendar date, in the tenant's timezone.
export type ReminderGroupKey = 'late' | 'today' | 'tomorrow' | 'upcoming' | 'sent';

export const REMINDER_GROUP_ORDER: readonly ReminderGroupKey[] = [
  'late',
  'today',
  'tomorrow',
  'upcoming',
  'sent',
];

export const REMINDER_GROUP_LABELS: Record<ReminderGroupKey, string> = {
  late: 'Atrasados',
  today: 'Hoje',
  tomorrow: 'Amanhã',
  upcoming: 'Próximos',
  sent: 'Enviados',
};

export type GroupableReminder = {
  badge: ReminderBadge;
  appointmentStartAtMs: number | null;
  dueAtMs: number;
  sentAtMs: number | null;
};

export function resolveReminderGroup(
  reminder: GroupableReminder,
  nowMs: number,
  timezone: string,
): ReminderGroupKey {
  if (reminder.badge === 'marked_sent') return 'sent';
  if (reminder.badge === 'overdue') return 'late';
  if (reminder.appointmentStartAtMs === null) return 'upcoming';

  const dateKey = formatInTimeZone(reminder.appointmentStartAtMs, timezone, 'yyyy-MM-dd');
  const todayKey = formatInTimeZone(nowMs, timezone, 'yyyy-MM-dd');
  const tomorrowKey = formatInTimeZone(nowMs + 24 * 60 * 60_000, timezone, 'yyyy-MM-dd');
  if (dateKey === todayKey) return 'today';
  if (dateKey === tomorrowKey) return 'tomorrow';
  return 'upcoming';
}

export type ReminderGroup<T> = { key: ReminderGroupKey; label: string; items: T[] };

// 27.1: "atrasados mais antigos; hoje por horário; amanhã; próximos; enviados por
// último." Groups first (fixed priority order above), then sorts within each group by
// whichever timestamp actually drives its own urgency: due date for "late" (the
// longest-overdue needs attention first), appointment time for every date-based group,
// and sent_at descending for "sent" (most recently handled first — an older sent
// reminder has nothing further to act on, so it can sink to the bottom).
export function groupReminders<T extends GroupableReminder>(
  reminders: readonly T[],
  nowMs: number,
  timezone: string,
): ReminderGroup<T>[] {
  const buckets = new Map<ReminderGroupKey, T[]>(REMINDER_GROUP_ORDER.map((key) => [key, []]));

  for (const reminder of reminders) {
    buckets.get(resolveReminderGroup(reminder, nowMs, timezone))!.push(reminder);
  }

  for (const key of REMINDER_GROUP_ORDER) {
    const items = buckets.get(key)!;
    if (key === 'late') {
      items.sort((a, b) => a.dueAtMs - b.dueAtMs);
    } else if (key === 'sent') {
      items.sort((a, b) => (b.sentAtMs ?? 0) - (a.sentAtMs ?? 0));
    } else {
      items.sort((a, b) => (a.appointmentStartAtMs ?? 0) - (b.appointmentStartAtMs ?? 0));
    }
  }

  return REMINDER_GROUP_ORDER.filter((key) => buckets.get(key)!.length > 0).map((key) => ({
    key,
    label: REMINDER_GROUP_LABELS[key],
    items: buckets.get(key)!,
  }));
}
