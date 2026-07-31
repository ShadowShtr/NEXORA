import { describe, expect, it } from 'vitest';
import {
  classifyOverlapConstraintViolation,
  generateMultiResourceSlots,
  isWithinOpenHours,
} from '@/features/appointments/domain/multi-resource-availability';
import type {
  BusinessHoursExceptionRow,
  BusinessHoursRow,
} from '@/features/appointments/domain/daily-schedule';

const TZ = 'Europe/Lisbon';
const TENANT_HOURS: BusinessHoursRow[] = [1, 2, 3, 4, 5].map((dayOfWeek) => ({
  dayOfWeek,
  isOpen: true,
  opensAt: '09:00',
  closesAt: '19:00',
  lunchStartsAt: null,
  lunchEndsAt: null,
}));

function baseInput(overrides: Partial<Parameters<typeof generateMultiResourceSlots>[0]> = {}) {
  return {
    timeZone: TZ,
    nowMs: Date.UTC(2026, 0, 5, 8, 0, 0), // Monday 2026-01-05, minNotice=0 -> 08:00 UTC boundary
    minNoticeHours: 0,
    bookingWindowDays: 1,
    slotStepMinutes: 30 as const,
    serviceDurationMinutes: 60,
    bufferMinutes: 15,
    tenantWeeklyHours: TENANT_HOURS,
    tenantExceptions: [] as BusinessHoursExceptionRow[],
    busy: [],
    ...overrides,
  };
}

describe('generateMultiResourceSlots (NEX-216)', () => {
  it('matches plain tenant availability when no provider is requested', () => {
    const slots = generateMultiResourceSlots(baseInput());
    expect(slots[0]).toBe(Date.UTC(2026, 0, 5, 9)); // 09:00 UTC opening
    expect(slots.length).toBeGreaterThan(0);
  });

  it("uses the provider's own (narrower) hours when one is requested", () => {
    const providerWeeklyHours: BusinessHoursRow[] = [
      {
        dayOfWeek: 1,
        isOpen: true,
        opensAt: '10:00',
        closesAt: '12:00',
        lunchStartsAt: null,
        lunchEndsAt: null,
      },
    ];
    const slots = generateMultiResourceSlots(baseInput({ providerWeeklyHours }));
    expect(slots[0]).toBe(Date.UTC(2026, 0, 5, 10));
    expect(slots.every((s) => s < Date.UTC(2026, 0, 5, 12))).toBe(true);
  });

  it('excludes slots overlapping merged busy intervals (tenant + provider + resource, all caller-merged)', () => {
    const busy = [{ startMs: Date.UTC(2026, 0, 5, 9), endMs: Date.UTC(2026, 0, 5, 11) }];
    const slots = generateMultiResourceSlots(baseInput({ busy }));
    expect(slots.every((s) => s >= Date.UTC(2026, 0, 5, 11))).toBe(true);
  });
});

describe('isWithinOpenHours (NEX-216: LOCATION_CLOSED)', () => {
  it('is true for a candidate fully inside business hours', () => {
    const result = isWithinOpenHours(
      { startMs: Date.UTC(2026, 0, 5, 10), endMs: Date.UTC(2026, 0, 5, 11) },
      '2026-01-05',
      1,
      TZ,
      TENANT_HOURS,
      [],
    );
    expect(result).toBe(true);
  });

  it('is false for a candidate outside business hours (LOCATION_CLOSED case)', () => {
    const result = isWithinOpenHours(
      { startMs: Date.UTC(2026, 0, 5, 20), endMs: Date.UTC(2026, 0, 5, 21) },
      '2026-01-05',
      1,
      TZ,
      TENANT_HOURS,
      [],
    );
    expect(result).toBe(false);
  });

  it('respects a narrower provider schedule even when the business itself is open', () => {
    const providerWeeklyHours: BusinessHoursRow[] = [
      {
        dayOfWeek: 1,
        isOpen: true,
        opensAt: '10:00',
        closesAt: '12:00',
        lunchStartsAt: null,
        lunchEndsAt: null,
      },
    ];
    const result = isWithinOpenHours(
      { startMs: Date.UTC(2026, 0, 5, 14), endMs: Date.UTC(2026, 0, 5, 15) },
      '2026-01-05',
      1,
      TZ,
      TENANT_HOURS,
      [],
      providerWeeklyHours,
      [],
    );
    expect(result).toBe(false);
  });
});

describe('classifyOverlapConstraintViolation (NEX-216)', () => {
  it.each([
    ['appointments_no_overlap_provider', 'PROVIDER_TAKEN'],
    ['appointments_no_overlap_resource', 'RESOURCE_TAKEN'],
    ['appointments_no_overlap_tenant_wide', 'SLOT_TAKEN'],
  ] as const)('maps %s to %s', (constraintName, expectedCode) => {
    expect(classifyOverlapConstraintViolation(constraintName)).toBe(expectedCode);
  });

  it('returns null for an unrelated constraint name', () => {
    expect(classifyOverlapConstraintViolation('some_other_constraint')).toBeNull();
  });
});
