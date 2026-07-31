import { describe, expect, it } from 'vitest';
import { resolveProviderDayHours } from '@/features/appointments/domain/provider-schedule';
import type {
  BusinessHoursExceptionRow,
  BusinessHoursRow,
} from '@/features/appointments/domain/daily-schedule';

// Business: Mon-Fri 09:00-19:00, no lunch (kept simple — daily-schedule.test.ts already
// covers lunch-splitting logic in resolveDayHours itself).
const TENANT_HOURS: BusinessHoursRow[] = [1, 2, 3, 4, 5].map((dayOfWeek) => ({
  dayOfWeek,
  isOpen: true,
  opensAt: '09:00',
  closesAt: '19:00',
  lunchStartsAt: null,
  lunchEndsAt: null,
}));
const TENANT_EXCEPTIONS: BusinessHoursExceptionRow[] = [
  {
    exceptionDate: '2026-03-17',
    isOpen: false,
    opensAt: null,
    closesAt: null,
    lunchStartsAt: null,
    lunchEndsAt: null,
  },
];

describe('resolveProviderDayHours (NEX-213)', () => {
  it('inherits the business schedule entirely when the provider has no hours of their own', () => {
    const hours = resolveProviderDayHours(
      '2026-03-16', // Monday
      1,
      [],
      [],
      TENANT_HOURS,
      TENANT_EXCEPTIONS,
    );
    expect(hours).toMatchObject({ isOpen: true, opensAt: '09:00', closesAt: '19:00' });
  });

  it('inherits the business exception too, when the provider has no hours of their own', () => {
    const hours = resolveProviderDayHours(
      '2026-03-17', // the tenant-wide closed exception
      2,
      [],
      [],
      TENANT_HOURS,
      TENANT_EXCEPTIONS,
    );
    expect(hours.isOpen).toBe(false);
  });

  it("uses the provider's own hours for a day they configured, but still inherits other days", () => {
    // Provider only works a shorter Monday (10:00-14:00); every other weekday must
    // still fall back to the business's 09:00-19:00.
    const providerWeekly: BusinessHoursRow[] = [
      {
        dayOfWeek: 1,
        isOpen: true,
        opensAt: '10:00',
        closesAt: '14:00',
        lunchStartsAt: null,
        lunchEndsAt: null,
      },
    ];

    const monday = resolveProviderDayHours(
      '2026-03-16',
      1,
      providerWeekly,
      [],
      TENANT_HOURS,
      TENANT_EXCEPTIONS,
    );
    expect(monday).toMatchObject({ isOpen: true, opensAt: '10:00', closesAt: '14:00' });

    const tuesday = resolveProviderDayHours(
      '2026-03-24', // a plain Tuesday, no exception (2026-03-17 is the tenant exception date)
      2,
      providerWeekly,
      [],
      TENANT_HOURS,
      TENANT_EXCEPTIONS,
    );
    expect(tuesday).toMatchObject({ isOpen: true, opensAt: '09:00', closesAt: '19:00' });
  });

  it("a provider-specific exception (e.g. their own day off) takes priority over the provider's weekly hours", () => {
    const providerWeekly: BusinessHoursRow[] = [
      {
        dayOfWeek: 1,
        isOpen: true,
        opensAt: '10:00',
        closesAt: '14:00',
        lunchStartsAt: null,
        lunchEndsAt: null,
      },
    ];
    const providerExceptions: BusinessHoursExceptionRow[] = [
      {
        exceptionDate: '2026-03-16',
        isOpen: false,
        opensAt: null,
        closesAt: null,
        lunchStartsAt: null,
        lunchEndsAt: null,
      },
    ];

    const hours = resolveProviderDayHours(
      '2026-03-16',
      1,
      providerWeekly,
      providerExceptions,
      TENANT_HOURS,
      TENANT_EXCEPTIONS,
    );
    expect(hours.isOpen).toBe(false);
  });

  it('a provider exception on a day with no provider weekly row still overrides the tenant schedule', () => {
    // Provider has no weekly hours configured at all for Wednesday, but took a specific
    // Wednesday off — that one-off exception must still win over inheriting the
    // business's normal Wednesday hours.
    const providerExceptions: BusinessHoursExceptionRow[] = [
      {
        exceptionDate: '2026-03-18',
        isOpen: false,
        opensAt: null,
        closesAt: null,
        lunchStartsAt: null,
        lunchEndsAt: null,
      },
    ];

    const hours = resolveProviderDayHours(
      '2026-03-18',
      3,
      [],
      providerExceptions,
      TENANT_HOURS,
      TENANT_EXCEPTIONS,
    );
    expect(hours.isOpen).toBe(false);
  });
});
