import { generateTimezoneAwareSlots } from './availability';
import type { BusyInterval, GenerateTimezoneAwareSlotsInput } from './availability';
import { resolveProviderDayHours } from './provider-schedule';
import { dayHoursToOpenIntervals } from './daily-schedule';
import type { BusinessHoursExceptionRow, BusinessHoursRow } from './daily-schedule';

// NEX-216: "Ordem de avaliação: serviço, localização, prestador opcional, recursos
// necessários, horários de negócio, horários do prestador, bloqueios, marcações,
// buffer." Reuses generateTimezoneAwareSlots (NEX-061) as-is — the only difference
// when a provider is picked is *which* hours resolver runs per day
// (resolveProviderDayHours, NEX-213, itself falling back to the business's own hours),
// and that the caller merges in provider-/resource-scoped busy intervals on top of the
// tenant-wide ones (ADR-012's three-way exclusion split has the same shape: tenant-wide
// busy always applies, provider-scoped and resource-scoped are additive on top).
export type GenerateMultiResourceSlotsInput = Readonly<{
  timeZone: string;
  nowMs: number;
  minNoticeHours: number;
  bookingWindowDays: number;
  slotStepMinutes: 15 | 30 | 60;
  serviceDurationMinutes: number;
  bufferMinutes: number;
  tenantWeeklyHours: readonly BusinessHoursRow[];
  tenantExceptions: readonly BusinessHoursExceptionRow[];
  // Omitted (or both empty) when no specific provider was requested — every day then
  // falls back to the tenant's own hours, identical to generateTimezoneAwareSlots on
  // its own.
  providerWeeklyHours?: readonly BusinessHoursRow[];
  providerExceptions?: readonly BusinessHoursExceptionRow[];
  // Caller's responsibility to have already merged in whichever of tenant-wide/
  // provider-scoped/resource-scoped busy intervals apply to this request (mirrors
  // computeAvailableSlotsMs's own busy-merging, src/lib/availability-lookup.ts).
  busy: readonly BusyInterval[];
}>;

export function generateMultiResourceSlots(input: GenerateMultiResourceSlotsInput): number[] {
  const providerWeeklyHours = input.providerWeeklyHours ?? [];
  const providerExceptions = input.providerExceptions ?? [];

  const resolveHours: NonNullable<GenerateTimezoneAwareSlotsInput['resolveHours']> = (
    dateKey,
    dayOfWeek,
    weeklyHours,
    exceptions,
  ) =>
    resolveProviderDayHours(
      dateKey,
      dayOfWeek,
      providerWeeklyHours,
      providerExceptions,
      weeklyHours,
      exceptions,
    );

  return generateTimezoneAwareSlots({
    timeZone: input.timeZone,
    nowMs: input.nowMs,
    minNoticeHours: input.minNoticeHours,
    bookingWindowDays: input.bookingWindowDays,
    slotStepMinutes: input.slotStepMinutes,
    serviceDurationMinutes: input.serviceDurationMinutes,
    bufferMinutes: input.bufferMinutes,
    weeklyHours: input.tenantWeeklyHours,
    exceptions: input.tenantExceptions,
    busy: input.busy,
    resolveHours,
  });
}

// LOCATION_CLOSED: the candidate slot doesn't even fall inside an open interval —
// checked *before* any booking attempt reaches the database (the exclusion
// constraints only ever fire for a genuine double-booking, never for "closed").
// dateKey/dayOfWeek describe the candidate's own calendar day (in the tenant's
// timezone) — the caller already has these from generating the slot list in the
// first place, so this doesn't recompute them.
export function isWithinOpenHours(
  candidate: { startMs: number; endMs: number },
  dateKey: string,
  dayOfWeek: number,
  timeZone: string,
  tenantWeeklyHours: readonly BusinessHoursRow[],
  tenantExceptions: readonly BusinessHoursExceptionRow[],
  providerWeeklyHours: readonly BusinessHoursRow[] = [],
  providerExceptions: readonly BusinessHoursExceptionRow[] = [],
): boolean {
  const hours = resolveProviderDayHours(
    dateKey,
    dayOfWeek,
    providerWeeklyHours,
    providerExceptions,
    tenantWeeklyHours,
    tenantExceptions,
  );
  const openIntervals = dayHoursToOpenIntervals(dateKey, hours, timeZone);
  return openIntervals.some(
    (interval) => candidate.startMs >= interval.startMs && candidate.endMs <= interval.endMs,
  );
}

export type MultiResourceConflictCode =
  'PROVIDER_TAKEN' | 'RESOURCE_TAKEN' | 'SLOT_TAKEN' | 'LOCATION_CLOSED';

// Maps a Postgres exclusion-constraint violation (23P01) to the right conflict code —
// which constraint fired (ADR-012's three-way split, 0043_resources_and_multi_resource_conflicts.sql)
// tells the caller *why* the booking attempt failed, the same distinction the public
// booking flow already makes for the plain tenant-wide case (SLOT_TAKEN,
// src/app/api/public/business/[slug]/bookings/route.ts). Returns null for anything
// that isn't one of these three constraints — the caller's own error path, not a
// silent conflict.
export function classifyOverlapConstraintViolation(
  constraintName: string,
): MultiResourceConflictCode | null {
  switch (constraintName) {
    case 'appointments_no_overlap_provider':
      return 'PROVIDER_TAKEN';
    case 'appointments_no_overlap_resource':
      return 'RESOURCE_TAKEN';
    case 'appointments_no_overlap_tenant_wide':
      return 'SLOT_TAKEN';
    default:
      return null;
  }
}
