import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Exercises create_recurring_series (NEX-122,
// supabase/migrations/0032_create_recurring_series.sql) through the same PostgREST
// boundary the app uses. Requires the same env vars as publish-business.test.ts; skips
// cleanly when unset.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

describe.runIf(canRun)('create_recurring_series (NEX-122)', () => {
  let admin: SupabaseClient;
  let userA: SupabaseClient;

  const tenantId = randomUUID();
  const email = `nex122-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}!`;
  let userId: string;
  const slug = `nex122-${tenantId.slice(0, 8)}`;
  let clientId: string;
  let serviceId: string;

  beforeAll(async () => {
    admin = createClient(url!, serviceRoleKey!);
    userA = createClient(url!, publishableKey!);

    await admin.from('tenants').insert({ id: tenantId, slug, name: 'Tenant', status: 'active' });
    await admin.from('business_settings').insert({ tenant_id: tenantId, buffer_minutes: 15 });

    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error) throw created.error;
    userId = created.data.user.id;
    await admin
      .from('profiles')
      .insert({ user_id: userId, tenant_id: tenantId, role: 'owner', display_name: 'Owner' });

    const signIn = await userA.auth.signInWithPassword({ email, password });
    if (signIn.error) throw signIn.error;

    const { data: client } = await admin
      .from('clients')
      .insert({ tenant_id: tenantId, name: 'Client', phone_e164: '+351910000122' })
      .select('id')
      .single();
    clientId = client!.id;

    const { data: category } = await admin
      .from('service_categories')
      .insert({ tenant_id: tenantId, name: 'Unhas', sort_order: 0 })
      .select('id')
      .single();

    const { data: service } = await admin
      .from('services')
      .insert({
        tenant_id: tenantId,
        category_id: category!.id,
        name: 'Verniz Gel',
        price_cents: 1500,
        duration_minutes: 30,
        is_active: true,
      })
      .select('id')
      .single();
    serviceId = service!.id;
  });

  afterAll(async () => {
    await admin.from('appointments').delete().eq('tenant_id', tenantId);
    await admin.from('recurring_series').delete().eq('tenant_id', tenantId);
    await admin.from('tenants').update({ status: 'deleted' }).eq('id', tenantId);
    await admin.auth.admin.deleteUser(userId);
  });

  // Weekly occurrences starting `daysFromNow` days out, spaced 7 days apart — far enough
  // in the future, and far enough from every other test's occurrences, to never collide
  // with a different test in this same file.
  function weeklyOccurrences(daysFromNow: number, count: number): string[] {
    const base = Date.now() + daysFromNow * 24 * 60 * 60_000;
    return Array.from({ length: count }, (_, i) =>
      new Date(base + i * 7 * 24 * 60 * 60_000).toISOString(),
    );
  }

  it('is not callable by anon', async () => {
    const anon = createClient(url!, publishableKey!);
    const { error } = await anon.rpc('create_recurring_series', {
      p_client_id: clientId,
      p_client_name: null,
      p_client_phone_e164: null,
      p_client_email: null,
      p_selected_service_ids: [serviceId],
      p_selected_package_id: null,
      p_frequency: 'weekly',
      p_interval_value: 1,
      p_occurrence_starts_at: weeklyOccurrences(10, 3),
      p_client_observation: null,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it('rejects fewer than 2 occurrences', async () => {
    const { error } = await userA.rpc('create_recurring_series', {
      p_client_id: clientId,
      p_client_name: null,
      p_client_phone_e164: null,
      p_client_email: null,
      p_selected_service_ids: [serviceId],
      p_selected_package_id: null,
      p_frequency: 'weekly',
      p_interval_value: 1,
      p_occurrence_starts_at: weeklyOccurrences(20, 1),
      p_client_observation: null,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('22023');
  });

  it('rejects an invalid frequency', async () => {
    const { error } = await userA.rpc('create_recurring_series', {
      p_client_id: clientId,
      p_client_name: null,
      p_client_phone_e164: null,
      p_client_email: null,
      p_selected_service_ids: [serviceId],
      p_selected_package_id: null,
      p_frequency: 'daily',
      p_interval_value: 1,
      p_occurrence_starts_at: weeklyOccurrences(30, 3),
      p_client_observation: null,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('22023');
  });

  it('rejects an interval_value outside 1-52', async () => {
    const { error } = await userA.rpc('create_recurring_series', {
      p_client_id: clientId,
      p_client_name: null,
      p_client_phone_e164: null,
      p_client_email: null,
      p_selected_service_ids: [serviceId],
      p_selected_package_id: null,
      p_frequency: 'custom',
      p_interval_value: 53,
      p_occurrence_starts_at: weeklyOccurrences(40, 3),
      p_client_observation: null,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('22023');
  });

  it("rejects a client that doesn't belong to the caller's tenant", async () => {
    const { error } = await userA.rpc('create_recurring_series', {
      p_client_id: randomUUID(),
      p_client_name: null,
      p_client_phone_e164: null,
      p_client_email: null,
      p_selected_service_ids: [serviceId],
      p_selected_package_id: null,
      p_frequency: 'weekly',
      p_interval_value: 1,
      p_occurrence_starts_at: weeklyOccurrences(50, 3),
      p_client_observation: null,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('22023');
  });

  it('creates the series and every occurrence atomically, with items/reminders/audit per appointment and one series-level audit row', async () => {
    const occurrences = weeklyOccurrences(60, 4);
    const { data: seriesId, error } = await userA.rpc('create_recurring_series', {
      p_client_id: clientId,
      p_client_name: null,
      p_client_phone_e164: null,
      p_client_email: null,
      p_selected_service_ids: [serviceId],
      p_selected_package_id: null,
      p_frequency: 'weekly',
      p_interval_value: 1,
      p_occurrence_starts_at: occurrences,
      p_client_observation: 'Prefere verniz vermelho.',
    });
    expect(error).toBeNull();
    expect(seriesId).toBeTruthy();

    const series = await admin
      .from('recurring_series')
      .select('client_id, frequency, interval_value, occurrence_count')
      .eq('id', seriesId as string)
      .single();
    expect(series.data).toMatchObject({
      client_id: clientId,
      frequency: 'weekly',
      interval_value: 1,
      occurrence_count: 4,
    });

    const appointments = await admin
      .from('appointments')
      .select('start_at, status, expected_total_cents, client_observation')
      .eq('recurring_series_id', seriesId as string)
      .order('start_at');
    expect(appointments.data).toHaveLength(4);
    expect(appointments.data!.map((a) => a.start_at)).toEqual(
      occurrences.map((iso) => new Date(iso).toISOString()),
    );
    for (const appointment of appointments.data!) {
      expect(appointment.status).toBe('confirmed');
      expect(appointment.expected_total_cents).toBe(1500);
      expect(appointment.client_observation).toBe('Prefere verniz vermelho.');
    }

    const appointmentIds = (
      await admin
        .from('appointments')
        .select('id')
        .eq('recurring_series_id', seriesId as string)
    ).data!.map((a) => a.id);

    const items = await admin
      .from('appointment_items')
      .select('appointment_id, source_type, unit_price_cents')
      .in('appointment_id', appointmentIds);
    expect(items.data).toHaveLength(4);
    for (const item of items.data!) {
      expect(item).toMatchObject({ source_type: 'service', unit_price_cents: 1500 });
    }

    const reminders = await admin
      .from('reminders')
      .select('appointment_id')
      .in('appointment_id', appointmentIds);
    expect(reminders.data).toHaveLength(4);

    const audit = await admin
      .from('audit_logs')
      .select('action, resource_type, actor_user_id, metadata')
      .eq('resource_id', seriesId as string)
      .eq('action', 'recurring_series.created');
    expect(audit.data).toHaveLength(1);
    expect(audit.data![0]).toMatchObject({
      action: 'recurring_series.created',
      resource_type: 'recurring_series',
      actor_user_id: userId,
    });
    expect(audit.data![0]!.metadata).toMatchObject({ occurrence_count: 4, frequency: 'weekly' });
  });

  it('rolls back the entire series (no recurring_series row, no appointments) when one occurrence collides with an existing appointment', async () => {
    const occurrences = weeklyOccurrences(80, 4);

    // Pre-existing appointment overlapping exactly the 3rd occurrence.
    const collidingStart = new Date(occurrences[2]!);
    const collidingEnd = new Date(collidingStart.getTime() + 30 * 60_000);
    const preExistingId = randomUUID();
    await admin.from('appointments').insert({
      id: preExistingId,
      tenant_id: tenantId,
      client_id: clientId,
      source: 'admin',
      status: 'confirmed',
      start_at: collidingStart.toISOString(),
      end_at: collidingEnd.toISOString(),
      blocked_until: new Date(collidingEnd.getTime() + 15 * 60_000).toISOString(),
      expected_total_cents: 1500,
      booking_token_hash: 'a'.repeat(64),
    });

    const seriesCountBefore = (
      await admin
        .from('recurring_series')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
    ).count;
    const appointmentsCountBefore = (
      await admin
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
    ).count;

    const { error } = await userA.rpc('create_recurring_series', {
      p_client_id: clientId,
      p_client_name: null,
      p_client_phone_e164: null,
      p_client_email: null,
      p_selected_service_ids: [serviceId],
      p_selected_package_id: null,
      p_frequency: 'weekly',
      p_interval_value: 1,
      p_occurrence_starts_at: occurrences,
      p_client_observation: null,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23P01');

    const seriesCountAfter = (
      await admin
        .from('recurring_series')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
    ).count;
    const appointmentsCountAfter = (
      await admin
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
    ).count;

    // No new recurring_series row, and only the one pre-existing appointment remains —
    // occurrences 1 and 2 (inserted earlier in the same failed transaction) did not
    // survive either.
    expect(seriesCountAfter).toBe(seriesCountBefore);
    expect(appointmentsCountAfter).toBe(appointmentsCountBefore);
  });
});
