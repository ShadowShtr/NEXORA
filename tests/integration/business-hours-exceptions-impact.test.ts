import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { getPublicAvailability as GetPublicAvailability } from '@/app/b/[slug]/availability-actions';

// NEX-125's own required test category ("Precedência de regras") is already unit-tested
// (tests/unit/daily-schedule.test.ts: "prefers an exception over the weekly schedule for
// the same date"). This proves the other half of the acceptance criterion end to end —
// "abrir dia fechado/prolongar e mostrar publicamente" — through getPublicAvailability
// (NEX-062), the same service-role-backed action the public booking page actually calls
// (business_hours_exceptions has no anon RLS policy, so this is the only path a real
// visitor's request takes). Same skip/mocking pattern as public-availability.test.ts.
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
}));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

describe.runIf(canRun)('business_hours_exceptions impact on public availability (NEX-125)', () => {
  let admin: SupabaseClient;
  let getPublicAvailability: typeof GetPublicAvailability;

  const tenantId = randomUUID();
  const slug = `nex125-${tenantId.slice(0, 8)}`;

  beforeAll(async () => {
    ({ getPublicAvailability } = await import('@/app/b/[slug]/availability-actions'));
    admin = createClient(url!, serviceRoleKey!);

    const { error: tenantError } = await admin
      .from('tenants')
      .insert({ id: tenantId, slug, name: 'Tenant', status: 'active' });
    if (tenantError) throw tenantError;

    // buffer_minutes/min_notice_hours are check-constrained to a fixed enum
    // (0001_initial.sql) — 15 and 1 are the smallest valid values for each.
    const { error: settingsError } = await admin.from('business_settings').insert({
      tenant_id: tenantId,
      timezone: 'Europe/Lisbon',
      slot_interval_minutes: 30,
      buffer_minutes: 15,
      min_notice_hours: 1,
      booking_window_days: 30,
      published_at: new Date().toISOString(),
    });
    if (settingsError) throw settingsError;

    // Closed every day except Wednesday (dayOfWeek 3), 09:00-18:00 — an unambiguous
    // "normally closed" day to open via exception, regardless of which weekday "today" is.
    const weeklyHours = Array.from({ length: 7 }, (_, dayOfWeek) => ({
      tenant_id: tenantId,
      day_of_week: dayOfWeek,
      is_open: dayOfWeek === 3,
      opens_at: dayOfWeek === 3 ? '09:00' : null,
      closes_at: dayOfWeek === 3 ? '18:00' : null,
    }));
    const { error: hoursError } = await admin.from('business_hours').insert(weeklyHours);
    if (hoursError) throw hoursError;
  });

  afterAll(async () => {
    await admin.from('tenants').delete().eq('id', tenantId);
  });

  // The next date at least 2 days out (clears min_notice_hours=0 easily) that is NOT a
  // Wednesday — i.e. a date the weekly schedule says is closed.
  function nextNormallyClosedDateKey(): string {
    for (let offset = 2; offset < 9; offset += 1) {
      const date = new Date(Date.now() + offset * 24 * 60 * 60_000);
      if (date.getUTCDay() !== 3) return date.toISOString().slice(0, 10);
    }
    throw new Error('unreachable');
  }

  it('opening a normally-closed day via an exception makes it bookable on the public page', async () => {
    const dateKey = nextNormallyClosedDateKey();

    const before = await getPublicAvailability({ tenantId, serviceDurationMinutes: 30 });
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    expect(before.value.slotsIso.some((iso) => iso.startsWith(dateKey))).toBe(false);

    await admin.from('business_hours_exceptions').insert({
      tenant_id: tenantId,
      exception_date: dateKey,
      is_open: true,
      opens_at: '10:00',
      closes_at: '12:00',
    });

    const after = await getPublicAvailability({ tenantId, serviceDurationMinutes: 30 });
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    const slotsThatDay = after.value.slotsIso.filter((iso) => iso.startsWith(dateKey));
    expect(slotsThatDay.length).toBeGreaterThan(0);
  });

  it('closing a normally-open day via an exception removes it from public availability', async () => {
    // Find the next Wednesday (normally open) at least 2 days out.
    let wednesdayKey = '';
    for (let offset = 2; offset < 9; offset += 1) {
      const date = new Date(Date.now() + offset * 24 * 60 * 60_000);
      if (date.getUTCDay() === 3) {
        wednesdayKey = date.toISOString().slice(0, 10);
        break;
      }
    }
    expect(wednesdayKey).not.toBe('');

    const before = await getPublicAvailability({ tenantId, serviceDurationMinutes: 30 });
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    expect(before.value.slotsIso.some((iso) => iso.startsWith(wednesdayKey))).toBe(true);

    await admin.from('business_hours_exceptions').insert({
      tenant_id: tenantId,
      exception_date: wednesdayKey,
      is_open: false,
      opens_at: null,
      closes_at: null,
    });

    const after = await getPublicAvailability({ tenantId, serviceDurationMinutes: 30 });
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.value.slotsIso.some((iso) => iso.startsWith(wednesdayKey))).toBe(false);
  });
});
