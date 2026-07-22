import { describe, expect, it } from 'vitest';
import {
  groupReminders,
  resolveReminderGroup,
  type GroupableReminder,
} from '@/features/reminders/domain/reminder-groups';

const TZ = 'Europe/Lisbon';
const hour = 60 * 60_000;
const day = 24 * hour;

function reminder(overrides: Partial<GroupableReminder> = {}): GroupableReminder {
  return {
    badge: 'pending',
    appointmentStartAtMs: Date.now() + hour,
    dueAtMs: Date.now() - hour,
    sentAtMs: null,
    ...overrides,
  };
}

describe('resolveReminderGroup', () => {
  it('groups an overdue reminder as "late" regardless of its appointment date', () => {
    const now = Date.parse('2026-05-20T10:00:00Z');
    const r = reminder({ badge: 'overdue', appointmentStartAtMs: now + 10 * day });
    expect(resolveReminderGroup(r, now, TZ)).toBe('late');
  });

  it('groups a marked_sent reminder as "sent" regardless of its appointment date', () => {
    const now = Date.parse('2026-05-20T10:00:00Z');
    const r = reminder({ badge: 'marked_sent', appointmentStartAtMs: now - 10 * day });
    expect(resolveReminderGroup(r, now, TZ)).toBe('sent');
  });

  it('groups a pending reminder for today\'s appointment as "today"', () => {
    const now = Date.parse('2026-05-20T10:00:00Z');
    const r = reminder({ badge: 'pending', appointmentStartAtMs: now + 2 * hour });
    expect(resolveReminderGroup(r, now, TZ)).toBe('today');
  });

  it('groups a pending reminder for tomorrow\'s appointment as "tomorrow"', () => {
    const now = Date.parse('2026-05-20T10:00:00Z');
    const r = reminder({ badge: 'opened', appointmentStartAtMs: now + day });
    expect(resolveReminderGroup(r, now, TZ)).toBe('tomorrow');
  });

  it('groups a pending reminder further out as "upcoming"', () => {
    const now = Date.parse('2026-05-20T10:00:00Z');
    const r = reminder({ badge: 'pending', appointmentStartAtMs: now + 5 * day });
    expect(resolveReminderGroup(r, now, TZ)).toBe('upcoming');
  });
});

describe('groupReminders', () => {
  it('orders groups as late, today, tomorrow, upcoming, sent — omitting empty groups', () => {
    const now = Date.parse('2026-05-20T10:00:00Z');
    const reminders = [
      reminder({ badge: 'marked_sent', sentAtMs: now - hour }),
      reminder({ badge: 'overdue', dueAtMs: now - hour }),
      reminder({ badge: 'pending', appointmentStartAtMs: now + hour }),
    ];
    const groups = groupReminders(reminders, now, TZ);
    expect(groups.map((g) => g.key)).toEqual(['late', 'today', 'sent']);
  });

  it('sorts the "late" group with the oldest overdue reminder first', () => {
    const now = Date.parse('2026-05-20T10:00:00Z');
    const reminders = [
      reminder({ badge: 'overdue', dueAtMs: now - hour }),
      reminder({ badge: 'overdue', dueAtMs: now - 3 * hour }),
      reminder({ badge: 'overdue', dueAtMs: now - 2 * hour }),
    ];
    const [group] = groupReminders(reminders, now, TZ);
    expect(group!.items.map((r) => r.dueAtMs)).toEqual([
      now - 3 * hour,
      now - 2 * hour,
      now - hour,
    ]);
  });

  it("sorts date-based groups by the appointment's own start time", () => {
    const now = Date.parse('2026-05-20T10:00:00Z');
    const reminders = [
      reminder({ badge: 'pending', appointmentStartAtMs: now + 5 * hour }),
      reminder({ badge: 'pending', appointmentStartAtMs: now + hour }),
      reminder({ badge: 'opened', appointmentStartAtMs: now + 3 * hour }),
    ];
    const [group] = groupReminders(reminders, now, TZ);
    expect(group!.items.map((r) => r.appointmentStartAtMs)).toEqual([
      now + hour,
      now + 3 * hour,
      now + 5 * hour,
    ]);
  });

  it('sorts the "sent" group with the most recently sent reminder first', () => {
    const now = Date.parse('2026-05-20T10:00:00Z');
    const reminders = [
      reminder({ badge: 'marked_sent', sentAtMs: now - 3 * day }),
      reminder({ badge: 'marked_sent', sentAtMs: now - hour }),
      reminder({ badge: 'marked_sent', sentAtMs: now - day }),
    ];
    const [group] = groupReminders(reminders, now, TZ);
    expect(group!.items.map((r) => r.sentAtMs)).toEqual([now - hour, now - day, now - 3 * day]);
  });
});
