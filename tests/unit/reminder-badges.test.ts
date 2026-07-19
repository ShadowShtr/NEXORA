import { describe, expect, it } from 'vitest';
import { resolveReminderBadge } from '@/features/reminders/domain/reminder-badges';

const NOW = new Date('2026-07-20T12:00:00Z').getTime();

describe('resolveReminderBadge', () => {
  it('is "pending" when due_at is still in the future', () => {
    const dueAt = NOW + 60 * 60_000;
    expect(resolveReminderBadge('pending', dueAt, NOW)).toBe('pending');
  });

  it('is "overdue" when a pending reminder is past its due_at', () => {
    const dueAt = NOW - 60 * 60_000;
    expect(resolveReminderBadge('pending', dueAt, NOW)).toBe('overdue');
  });

  it('is "overdue" exactly at due_at (>=, not only >)', () => {
    expect(resolveReminderBadge('pending', NOW, NOW)).toBe('overdue');
  });

  it('passes through opened/marked_sent/skipped regardless of due_at', () => {
    const pastDueAt = NOW - 60 * 60_000;
    expect(resolveReminderBadge('opened', pastDueAt, NOW)).toBe('opened');
    expect(resolveReminderBadge('marked_sent', pastDueAt, NOW)).toBe('marked_sent');
    expect(resolveReminderBadge('skipped', pastDueAt, NOW)).toBe('skipped');
  });
});
