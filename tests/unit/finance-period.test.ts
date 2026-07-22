import { describe, expect, it } from 'vitest';
import { addDays, resolveCalendarRange } from '@/features/appointments/domain/calendar-navigation';
import {
  formatFinanceRangeLabel,
  resolveCustomRange,
  resolvePreviousRange,
  summaryTitle,
  type FinancePeriod,
} from '@/features/finance/domain/period';

const TZ = 'Europe/Lisbon';

describe('resolveCustomRange', () => {
  it('resolves an inclusive [from, to] range to the right dateKeys', () => {
    const range = resolveCustomRange('2026-05-20', '2026-05-26', TZ);
    expect(range.dateKeys).toEqual([
      '2026-05-20',
      '2026-05-21',
      '2026-05-22',
      '2026-05-23',
      '2026-05-24',
      '2026-05-25',
      '2026-05-26',
    ]);
  });

  it('swaps from/to when given backwards instead of erroring', () => {
    const range = resolveCustomRange('2026-05-26', '2026-05-20', TZ);
    expect(range.dateKeys[0]).toBe('2026-05-20');
    expect(range.dateKeys[range.dateKeys.length - 1]).toBe('2026-05-26');
  });

  it('clamps a pathologically wide range instead of resolving unbounded years of data', () => {
    const range = resolveCustomRange('2000-01-01', '2026-01-01', TZ);
    expect(range.dateKeys.length).toBeLessThanOrEqual(366);
  });

  it('resolves the end boundary as the start of the day AFTER "to" (exclusive), across a DST transition', () => {
    // 2026-03-29 is the WET->WEST spring-forward Sunday in Europe/Lisbon.
    const range = resolveCustomRange('2026-03-28', '2026-03-29', TZ);
    const startMs = new Date(range.startIso).getTime();
    const endMs = new Date(range.endIso).getTime();
    // Only 23 hours elapse locally on the DST day, so the two-day span is 47h, not 48h.
    expect(endMs - startMs).toBe(47 * 60 * 60_000);
  });
});

describe('resolvePreviousRange', () => {
  it('resolves the previous day for a "day" view', () => {
    const period: FinancePeriod = {
      view: 'day',
      dateKey: '2026-05-20',
      range: { startIso: '', endIso: '', dateKeys: ['2026-05-20'] },
    };
    const previous = resolvePreviousRange(period, TZ);
    expect(previous.dateKeys).toEqual(['2026-05-19']);
  });

  it('resolves the previous calendar week (7 days immediately before) for a "week" view', () => {
    const dateKey = '2026-05-20';
    const currentRange = resolveCalendarRange('week', dateKey, TZ);
    const period: FinancePeriod = { view: 'week', dateKey, range: currentRange };

    const previous = resolvePreviousRange(period, TZ);
    expect(previous.dateKeys).toHaveLength(7);
    expect(previous.dateKeys[previous.dateKeys.length - 1]).toBe(
      addDays(currentRange.dateKeys[0]!, -1),
    );
  });

  it('resolves the same-length span immediately before a custom range', () => {
    const range = resolveCustomRange('2026-05-20', '2026-05-26', TZ);
    const period: FinancePeriod = { view: 'custom', dateKey: '2026-05-20', range };
    const previous = resolvePreviousRange(period, TZ);
    expect(previous.dateKeys).toEqual([
      '2026-05-13',
      '2026-05-14',
      '2026-05-15',
      '2026-05-16',
      '2026-05-17',
      '2026-05-18',
      '2026-05-19',
    ]);
  });
});

describe('formatFinanceRangeLabel', () => {
  it('formats a custom range as "dd/MM – dd/MM", matching the week view\'s own format', () => {
    const range = resolveCustomRange('2026-05-20', '2026-05-26', TZ);
    const period: FinancePeriod = { view: 'custom', dateKey: '2026-05-20', range };
    expect(formatFinanceRangeLabel(period, TZ)).toBe('20/05 – 26/05');
  });
});

describe('summaryTitle', () => {
  it('labels each view with the right Portuguese title', () => {
    expect(summaryTitle('day')).toBe('Resumo de hoje');
    expect(summaryTitle('week')).toBe('Resumo da semana');
    expect(summaryTitle('month')).toBe('Resumo do mês');
    expect(summaryTitle('custom')).toBe('Resumo do período');
  });
});
