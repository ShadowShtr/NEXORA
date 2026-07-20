import { describe, expect, it } from 'vitest';
import {
  buildDashboardSummary,
  type AppointmentSummary,
} from '@/features/dashboard/domain/summary';

const minute = 60_000;
const hour = 60 * minute;

function appointment(overrides: Partial<AppointmentSummary> = {}): AppointmentSummary {
  return {
    id: 'apt-1',
    clientName: 'Ana',
    startAtMs: 0,
    endAtMs: hour,
    status: 'confirmed',
    itemDescriptions: ['Verniz Gel'],
    totalCents: 3000,
    ...overrides,
  };
}

describe('buildDashboardSummary', () => {
  it('picks the earliest still-upcoming active appointment as "next"', () => {
    const now = 5 * hour;
    const appointments = [
      appointment({ id: 'later', startAtMs: 10 * hour, endAtMs: 11 * hour, clientName: 'Beatriz' }),
      appointment({ id: 'sooner', startAtMs: 6 * hour, endAtMs: 7 * hour, clientName: 'Ana' }),
      appointment({
        id: 'already-past',
        startAtMs: 1 * hour,
        endAtMs: 2 * hour,
        clientName: 'Carla',
      }),
    ];

    const summary = buildDashboardSummary(appointments, 0, 0, 0, now);
    expect(summary.nextAppointment?.id).toBe('sooner');
  });

  it('ignores cancelled/no_show/completed appointments for "next"', () => {
    const now = 0;
    const appointments = [
      appointment({ id: 'cancelled', startAtMs: hour, status: 'cancelled' }),
      appointment({ id: 'no_show', startAtMs: 2 * hour, status: 'no_show' }),
      appointment({ id: 'completed', startAtMs: 3 * hour, status: 'completed' }),
      appointment({ id: 'confirmed', startAtMs: 4 * hour, endAtMs: 5 * hour, status: 'confirmed' }),
    ];

    const summary = buildDashboardSummary(appointments, 0, 0, 0, now);
    expect(summary.nextAppointment?.id).toBe('confirmed');
  });

  it('treats an appointment already in progress (started, not yet ended) as still upcoming', () => {
    const now = 30 * minute;
    const appointments = [appointment({ id: 'in-progress', startAtMs: 0, endAtMs: hour })];

    const summary = buildDashboardSummary(appointments, 0, 0, 0, now);
    expect(summary.nextAppointment?.id).toBe('in-progress');
  });

  it('returns null for "next" when there are no active appointments left today', () => {
    const now = 20 * hour;
    const appointments = [appointment({ id: 'past', startAtMs: 5 * hour, endAtMs: 6 * hour })];

    const summary = buildDashboardSummary(appointments, 0, 0, 0, now);
    expect(summary.nextAppointment).toBeNull();
  });

  it('counts only active (confirmed/presence_confirmed) appointments in todayCount', () => {
    const appointments = [
      appointment({ id: 'a', status: 'confirmed' }),
      appointment({ id: 'b', status: 'presence_confirmed' }),
      appointment({ id: 'c', status: 'cancelled' }),
      appointment({ id: 'd', status: 'no_show' }),
    ];

    const summary = buildDashboardSummary(appointments, 0, 0, 0, 0);
    expect(summary.todayCount).toBe(2);
  });

  it('sums totalCents across only active appointments for invoicedTodayCents', () => {
    const appointments = [
      appointment({ id: 'a', status: 'confirmed', totalCents: 2000 }),
      appointment({ id: 'b', status: 'presence_confirmed', totalCents: 1500 }),
      appointment({ id: 'c', status: 'cancelled', totalCents: 9999 }),
    ];

    const summary = buildDashboardSummary(appointments, 0, 0, 0, 0);
    expect(summary.invoicedTodayCents).toBe(3500);
  });

  it('passes through pendingRemindersCount, receivedTodayCents and pendingTodayCents unchanged', () => {
    const summary = buildDashboardSummary([], 3, 4500, 1200, 0);
    expect(summary.pendingRemindersCount).toBe(3);
    expect(summary.receivedTodayCents).toBe(4500);
    expect(summary.pendingTodayCents).toBe(1200);
  });
});
