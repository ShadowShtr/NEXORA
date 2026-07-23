import { describe, expect, it } from 'vitest';
import {
  buildWeeklyHoursLines,
  resolveTodayHoursSummary,
  type BusinessHourRow,
} from '@/app/b/[slug]/domain/hours-summary';

const TZ = 'Europe/Lisbon';

function row(overrides: Partial<BusinessHourRow> = {}): BusinessHourRow {
  return { dayOfWeek: 1, isOpen: true, opensAt: '09:00:00', closesAt: '19:00:00', ...overrides };
}

describe('resolveTodayHoursSummary', () => {
  it('reports the open window for today', () => {
    // 2026-05-20 is a Wednesday (dayOfWeek 3).
    const now = Date.parse('2026-05-20T10:00:00Z');
    const rows = [row({ dayOfWeek: 3, opensAt: '09:00:00', closesAt: '19:00:00' })];
    expect(resolveTodayHoursSummary(rows, TZ, now)).toEqual({
      status: 'open',
      label: 'Aberto hoje · 09:00–19:00',
    });
  });

  it('reports closed when today has no row at all', () => {
    const now = Date.parse('2026-05-20T10:00:00Z');
    expect(resolveTodayHoursSummary([], TZ, now)).toEqual({
      status: 'closed',
      label: 'Fechado hoje',
    });
  });

  it("reports closed when today's row exists but is_open is false", () => {
    const now = Date.parse('2026-05-20T10:00:00Z');
    const rows = [row({ dayOfWeek: 3, isOpen: false, opensAt: null, closesAt: null })];
    expect(resolveTodayHoursSummary(rows, TZ, now).status).toBe('closed');
  });

  it('is still "aberto hoje" during the lunch break, not just outside it', () => {
    // Midday, within the scheduled window — the summary is the day's whole window, not
    // a live open-right-now check, so lunch closures don't change this line.
    const now = Date.parse('2026-05-20T12:30:00Z');
    const rows = [row({ dayOfWeek: 3, opensAt: '09:00:00', closesAt: '19:00:00' })];
    expect(resolveTodayHoursSummary(rows, TZ, now).status).toBe('open');
  });
});

describe('buildWeeklyHoursLines', () => {
  it('returns all 7 days in Sunday-first order with "Fechado" for missing/closed days', () => {
    const rows = [
      row({ dayOfWeek: 1, opensAt: '09:00:00', closesAt: '19:00:00' }),
      row({ dayOfWeek: 6, opensAt: '09:00:00', closesAt: '14:00:00' }),
    ];
    const lines = buildWeeklyHoursLines(rows);
    expect(lines).toHaveLength(7);
    expect(lines[0]).toEqual({ dayLabel: 'Domingo', hoursLabel: 'Fechado' });
    expect(lines[1]).toEqual({ dayLabel: 'Segunda-feira', hoursLabel: '09:00–19:00' });
    expect(lines[6]).toEqual({ dayLabel: 'Sábado', hoursLabel: '09:00–14:00' });
  });
});
