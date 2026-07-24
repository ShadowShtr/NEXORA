import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Exercises cancel_recurring_series (NEX-123,
// supabase/migrations/0033_cancel_recurring_series_scope.sql) through the same
// PostgREST boundary the app uses. Requires the same env vars as
// publish-business.test.ts; skips cleanly when unset.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

function bookingTokenHash(seed: string) {
  return seed.padEnd(64, '0').slice(0, 64);
}

describe.runIf(canRun)('cancel_recurring_series (NEX-123)', () => {
  let admin: SupabaseClient;
  let userA: SupabaseClient;
  let userB: SupabaseClient;

  const tenantAId = randomUUID();
  const tenantBId = randomUUID();
  const emailA = `nex123-a-${randomUUID()}@example.test`;
  const emailB = `nex123-b-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}!`;
  let userAId: string;
  let userBId: string;
  const slugA = `nex123-a-${tenantAId.slice(0, 8)}`;
  const slugB = `nex123-b-${tenantBId.slice(0, 8)}`;
  let clientAId: string;

  beforeAll(async () => {
    admin = createClient(url!, serviceRoleKey!);
    userA = createClient(url!, publishableKey!);
    userB = createClient(url!, publishableKey!);

    await admin.from('tenants').insert([
      { id: tenantAId, slug: slugA, name: 'Tenant A', status: 'active' },
      { id: tenantBId, slug: slugB, name: 'Tenant B', status: 'active' },
    ]);
    await admin.from('business_settings').insert([
      { tenant_id: tenantAId, buffer_minutes: 15 },
      { tenant_id: tenantBId, buffer_minutes: 15 },
    ]);

    const createdA = await admin.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
    });
    if (createdA.error) throw createdA.error;
    userAId = createdA.data.user.id;
    const createdB = await admin.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
    });
    if (createdB.error) throw createdB.error;
    userBId = createdB.data.user.id;

    await admin.from('profiles').insert([
      { user_id: userAId, tenant_id: tenantAId, role: 'owner', display_name: 'Owner A' },
      { user_id: userBId, tenant_id: tenantBId, role: 'owner', display_name: 'Owner B' },
    ]);

    const signInA = await userA.auth.signInWithPassword({ email: emailA, password });
    if (signInA.error) throw signInA.error;
    const signInB = await userB.auth.signInWithPassword({ email: emailB, password });
    if (signInB.error) throw signInB.error;

    const { data: client } = await admin
      .from('clients')
      .insert({ tenant_id: tenantAId, name: 'Client A', phone_e164: '+351910000123' })
      .select('id')
      .single();
    clientAId = client!.id;
  });

  afterAll(async () => {
    await admin.from('tenants').update({ status: 'deleted' }).in('id', [tenantAId, tenantBId]);
    await admin.auth.admin.deleteUser(userAId);
    await admin.auth.admin.deleteUser(userBId);
  });

  async function seedSeries() {
    const { data } = await admin
      .from('recurring_series')
      .insert({
        tenant_id: tenantAId,
        client_id: clientAId,
        frequency: 'weekly',
        interval_value: 1,
        occurrence_count: 3,
      })
      .select('id')
      .single();
    return data!.id as string;
  }

  async function seedAppointment(opts: {
    startAt: Date;
    seriesId?: string | null;
    status?: 'confirmed' | 'presence_confirmed' | 'completed' | 'cancelled' | 'no_show';
  }) {
    const endAt = new Date(opts.startAt.getTime() + 60 * 60_000);
    const id = randomUUID();
    const { error } = await admin.from('appointments').insert({
      id,
      tenant_id: tenantAId,
      client_id: clientAId,
      recurring_series_id: opts.seriesId ?? null,
      source: 'admin',
      status: opts.status ?? 'confirmed',
      start_at: opts.startAt.toISOString(),
      end_at: endAt.toISOString(),
      blocked_until: new Date(endAt.getTime() + 15 * 60_000).toISOString(),
      expected_total_cents: 1500,
      booking_token_hash: bookingTokenHash(id),
    });
    if (error) throw error;
    return id;
  }

  it('is not callable by anon', async () => {
    const anon = createClient(url!, publishableKey!);
    const seriesId = await seedSeries();
    const appointmentId = await seedAppointment({
      startAt: new Date(Date.now() + 24 * 60 * 60_000),
      seriesId,
    });
    const { error } = await anon.rpc('cancel_recurring_series', {
      p_appointment_id: appointmentId,
      p_scope: 'all',
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it('rejects an invalid scope', async () => {
    const seriesId = await seedSeries();
    const appointmentId = await seedAppointment({
      startAt: new Date(Date.now() + 26 * 60 * 60_000),
      seriesId,
    });
    const { error } = await userA.rpc('cancel_recurring_series', {
      p_appointment_id: appointmentId,
      p_scope: 'this',
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('22023');
  });

  it("rejects an appointment from another tenant's series", async () => {
    const seriesId = await seedSeries();
    const appointmentId = await seedAppointment({
      startAt: new Date(Date.now() + 28 * 60 * 60_000),
      seriesId,
    });
    const { error } = await userB.rpc('cancel_recurring_series', {
      p_appointment_id: appointmentId,
      p_scope: 'all',
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('22023');

    const still = await admin
      .from('appointments')
      .select('status')
      .eq('id', appointmentId)
      .single();
    expect(still.data?.status).toBe('confirmed');
  });

  it("rejects an appointment that doesn't belong to any series", async () => {
    const appointmentId = await seedAppointment({
      startAt: new Date(Date.now() + 30 * 60 * 60_000),
      seriesId: null,
    });
    const { error } = await userA.rpc('cancel_recurring_series', {
      p_appointment_id: appointmentId,
      p_scope: 'all',
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('22023');
  });

  it('rejects an appointment that is already cancelled/completed/no_show', async () => {
    const seriesId = await seedSeries();
    const appointmentId = await seedAppointment({
      startAt: new Date(Date.now() + 32 * 60 * 60_000),
      seriesId,
      status: 'completed',
    });
    const { error } = await userA.rpc('cancel_recurring_series', {
      p_appointment_id: appointmentId,
      p_scope: 'all',
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('22023');
  });

  it("'this_and_future' cancels the triggering occurrence and later ones, leaving earlier and non-cancellable ones untouched", async () => {
    const seriesId = await seedSeries();
    const base = Date.now() + 40 * 60 * 60_000;
    const earlier = await seedAppointment({
      startAt: new Date(base),
      seriesId,
      status: 'completed', // already happened — must survive untouched either way
    });
    const trigger = await seedAppointment({
      startAt: new Date(base + 7 * 24 * 60 * 60_000),
      seriesId,
    });
    const future1 = await seedAppointment({
      startAt: new Date(base + 14 * 24 * 60 * 60_000),
      seriesId,
    });
    const future2 = await seedAppointment({
      startAt: new Date(base + 21 * 24 * 60 * 60_000),
      seriesId,
      status: 'cancelled', // already cancelled — should not be double-counted
    });

    const { data: cancelledCount, error } = await userA.rpc('cancel_recurring_series', {
      p_appointment_id: trigger,
      p_scope: 'this_and_future',
    });
    expect(error).toBeNull();
    expect(cancelledCount).toBe(2); // trigger + future1 (future2 was already cancelled)

    const statuses = await admin
      .from('appointments')
      .select('id, status')
      .in('id', [earlier, trigger, future1, future2]);
    const byId = new Map(statuses.data!.map((row) => [row.id, row.status]));
    expect(byId.get(earlier)).toBe('completed');
    expect(byId.get(trigger)).toBe('cancelled');
    expect(byId.get(future1)).toBe('cancelled');
    expect(byId.get(future2)).toBe('cancelled');

    const audit = await admin
      .from('audit_logs')
      .select('action, resource_type, resource_id, metadata')
      .eq('resource_id', seriesId)
      .eq('action', 'recurring_series.cancelled')
      .single();
    expect(audit.data).toMatchObject({
      action: 'recurring_series.cancelled',
      resource_type: 'recurring_series',
    });
    expect(audit.data?.metadata).toMatchObject({
      scope: 'this_and_future',
      triggered_from_appointment_id: trigger,
      cancelled_count: 2,
    });
    expect(new Set(audit.data?.metadata.cancelled_appointment_ids)).toEqual(
      new Set([trigger, future1]),
    );
  });

  it("'all' cancels every still-cancellable occurrence regardless of date", async () => {
    const seriesId = await seedSeries();
    const base = Date.now() + 60 * 60 * 60_000;
    const earlier = await seedAppointment({ startAt: new Date(base), seriesId });
    const trigger = await seedAppointment({
      startAt: new Date(base + 7 * 24 * 60 * 60_000),
      seriesId,
    });
    const future = await seedAppointment({
      startAt: new Date(base + 14 * 24 * 60 * 60_000),
      seriesId,
    });

    const { data: cancelledCount, error } = await userA.rpc('cancel_recurring_series', {
      p_appointment_id: trigger,
      p_scope: 'all',
    });
    expect(error).toBeNull();
    expect(cancelledCount).toBe(3);

    const statuses = await admin
      .from('appointments')
      .select('id, status')
      .in('id', [earlier, trigger, future]);
    for (const row of statuses.data!) {
      expect(row.status).toBe('cancelled');
    }
  });
});
