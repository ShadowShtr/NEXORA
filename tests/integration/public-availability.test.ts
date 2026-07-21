import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { getPublicAvailability as GetPublicAvailability } from '@/app/b/[slug]/availability-actions';

// Exercises getPublicAvailability (NEX-062) — a server action, not a DB RPC, but it
// reads business_hours/business_hours_exceptions/availability_blocks/appointments
// through the service-role client, none of which carry an `anon` policy — so this needs
// a real Supabase project to prove tenant isolation and the published/active gate
// actually hold. Same skip pattern as the other integration tests: no-op cleanly when
// env vars are unset.
//
// The action itself is imported dynamically inside beforeAll (not statically at module
// top) because it transitively imports src/lib/env.ts, which parses process.env eagerly
// at import time — a static import would throw and abort the whole file before
// describe.runIf ever gets a chance to skip cleanly when env vars are absent.
//
// getRequestIp (src/lib/request-ip.ts, used for the action's rate limit) calls next/headers'
// headers(), which throws "called outside a request scope" unless the App Router's own
// request-handling machinery is what's calling it — never the case here, since this test
// invokes the action directly. Mocking next/headers to a Headers-less stub is the
// standard way to exercise a Server Action outside of next dev/start; getRequestIp's own
// fallback (no x-forwarded-for/x-real-ip -> 'unknown') already handles an empty header
// set correctly, so this doesn't change what's under test.
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
}));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

describe.runIf(canRun)('getPublicAvailability (NEX-062)', () => {
  let admin: SupabaseClient;
  let getPublicAvailability: typeof GetPublicAvailability;

  const tenantAId = randomUUID();
  const tenantBId = randomUUID();
  const unpublishedTenantId = randomUUID();
  const slugA = `nex062-a-${tenantAId.slice(0, 8)}`;
  const slugB = `nex062-b-${tenantBId.slice(0, 8)}`;
  const slugUnpublished = `nex062-u-${unpublishedTenantId.slice(0, 8)}`;

  beforeAll(async () => {
    ({ getPublicAvailability } = await import('@/app/b/[slug]/availability-actions'));
    admin = createClient(url!, serviceRoleKey!);

    const { error: tenantsError } = await admin.from('tenants').insert([
      { id: tenantAId, slug: slugA, name: 'Tenant A', status: 'active' },
      { id: tenantBId, slug: slugB, name: 'Tenant B', status: 'active' },
      {
        id: unpublishedTenantId,
        slug: slugUnpublished,
        name: 'Tenant Unpublished',
        status: 'active',
      },
    ]);
    if (tenantsError) throw tenantsError;

    const publishedAt = new Date().toISOString();
    const { error: settingsError } = await admin.from('business_settings').insert([
      {
        tenant_id: tenantAId,
        timezone: 'Europe/Lisbon',
        slot_interval_minutes: 30,
        buffer_minutes: 15,
        min_notice_hours: 1,
        booking_window_days: 30,
        published_at: publishedAt,
      },
      {
        tenant_id: tenantBId,
        timezone: 'Europe/Lisbon',
        slot_interval_minutes: 30,
        buffer_minutes: 15,
        min_notice_hours: 1,
        booking_window_days: 30,
        published_at: publishedAt,
      },
      {
        tenant_id: unpublishedTenantId,
        timezone: 'Europe/Lisbon',
        slot_interval_minutes: 30,
        buffer_minutes: 15,
        min_notice_hours: 1,
        booking_window_days: 30,
        published_at: null,
      },
    ]);
    if (settingsError) throw settingsError;

    // Both tenants open every day of the week 09:00-18:00, no lunch — simplest shape to
    // assert against without depending on "today"'s specific day of week.
    const everyDayOpen = (tenantId: string) =>
      Array.from({ length: 7 }, (_, dayOfWeek) => ({
        tenant_id: tenantId,
        day_of_week: dayOfWeek,
        is_open: true,
        opens_at: '09:00',
        closes_at: '18:00',
      }));
    const { error: hoursError } = await admin
      .from('business_hours')
      .insert([...everyDayOpen(tenantAId), ...everyDayOpen(tenantBId)]);
    if (hoursError) throw hoursError;

    // A full-day block on tenant A only, starting tomorrow — used to prove it suppresses
    // slots for A without affecting B (tenant isolation).
    const blockStart = new Date(Date.now() + 24 * 60 * 60_000);
    blockStart.setUTCHours(0, 0, 0, 0);
    const blockEnd = new Date(blockStart.getTime() + 24 * 60 * 60_000);
    const { error: blockError } = await admin.from('availability_blocks').insert({
      tenant_id: tenantAId,
      starts_at: blockStart.toISOString(),
      ends_at: blockEnd.toISOString(),
      reason: 'nex062 test block',
      is_all_day: true,
    });
    if (blockError) throw blockError;
  });

  afterAll(async () => {
    await admin.from('tenants').delete().in('id', [tenantAId, tenantBId, unpublishedTenantId]);
  });

  it('rejects invalid input before touching the database', async () => {
    const result = await getPublicAvailability({
      tenantId: 'not-a-uuid',
      serviceDurationMinutes: 60,
    } as never);
    expect(result).toEqual({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Pedido inválido.' },
    });
  });

  it('returns NOT_FOUND for a tenant that has never published', async () => {
    const result = await getPublicAvailability({
      tenantId: unpublishedTenantId,
      serviceDurationMinutes: 60,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND');
  });

  it('returns NOT_FOUND for a tenant id that does not exist', async () => {
    const result = await getPublicAvailability({
      tenantId: randomUUID(),
      serviceDurationMinutes: 60,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND');
  });

  it('returns slots for tenant A that are absent on the all-day-blocked date, while tenant B (unaffected) still has slots that day', async () => {
    const resultA = await getPublicAvailability({
      tenantId: tenantAId,
      serviceDurationMinutes: 30,
    });
    const resultB = await getPublicAvailability({
      tenantId: tenantBId,
      serviceDurationMinutes: 30,
    });
    expect(resultA.ok).toBe(true);
    expect(resultB.ok).toBe(true);
    if (!resultA.ok || !resultB.ok) return;

    const blockedDateKey = new Date(Date.now() + 24 * 60 * 60_000).toISOString().slice(0, 10);
    const aSlotsOnBlockedDate = resultA.value.slotsIso.filter((iso) =>
      iso.startsWith(blockedDateKey),
    );
    const bSlotsOnSameDate = resultB.value.slotsIso.filter((iso) => iso.startsWith(blockedDateKey));

    expect(aSlotsOnBlockedDate).toEqual([]);
    expect(bSlotsOnSameDate.length).toBeGreaterThan(0);
  });
});
