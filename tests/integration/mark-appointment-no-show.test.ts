import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Exercises mark_appointment_no_show (NEX-095, supabase/migrations/0011_no_show_policy.sql)
// through the same PostgREST boundary the app uses. Requires the same env vars as
// publish-business.test.ts; skips cleanly when unset.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

function bookingTokenHash(seed: string) {
  return seed.padEnd(64, '0').slice(0, 64);
}

describe.runIf(canRun)('mark_appointment_no_show (NEX-095)', () => {
  let admin: SupabaseClient;
  let userA: SupabaseClient;
  let userB: SupabaseClient;

  const tenantAId = randomUUID();
  const tenantBId = randomUUID();
  const emailA = `nex095-a-${randomUUID()}@example.test`;
  const emailB = `nex095-b-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}!`;
  let userAId: string;
  let userBId: string;
  const slugA = `nex095-a-${tenantAId.slice(0, 8)}`;
  const slugB = `nex095-b-${tenantBId.slice(0, 8)}`;
  let clientAId: string;

  beforeAll(async () => {
    admin = createClient(url!, serviceRoleKey!);
    userA = createClient(url!, publishableKey!);
    userB = createClient(url!, publishableKey!);

    const { error: tenantsError } = await admin.from('tenants').insert([
      { id: tenantAId, slug: slugA, name: 'Tenant A', status: 'active' },
      { id: tenantBId, slug: slugB, name: 'Tenant B', status: 'active' },
    ]);
    if (tenantsError) throw tenantsError;

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
      .insert({ tenant_id: tenantAId, name: 'Client A', phone_e164: '+351910000020' })
      .select('id')
      .single();
    clientAId = client!.id;
  });

  afterAll(async () => {
    await admin.from('tenants').delete().in('id', [tenantAId, tenantBId]);
    await admin.auth.admin.deleteUser(userAId);
    await admin.auth.admin.deleteUser(userBId);
  });

  async function seedAppointment(startAt: Date) {
    const endAt = new Date(startAt.getTime() + 60 * 60_000);
    const id = randomUUID();
    await admin.from('appointments').insert({
      id,
      tenant_id: tenantAId,
      client_id: clientAId,
      source: 'admin',
      status: 'confirmed',
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      blocked_until: new Date(endAt.getTime() + 15 * 60_000).toISOString(),
      expected_total_cents: 2500,
      booking_token_hash: bookingTokenHash(id),
    });
    return id;
  }

  it('is not callable by anon', async () => {
    const anon = createClient(url!, publishableKey!);
    const appointmentId = await seedAppointment(new Date(Date.now() - 24 * 60 * 60_000));
    const { error } = await anon.rpc('mark_appointment_no_show', {
      p_appointment_id: appointmentId,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it("rejects marking another tenant's appointment", async () => {
    const appointmentId = await seedAppointment(new Date(Date.now() - 25 * 60 * 60_000));
    const { error } = await userB.rpc('mark_appointment_no_show', {
      p_appointment_id: appointmentId,
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

  it("marks the caller's own appointment as no_show and writes an audit log entry", async () => {
    const appointmentId = await seedAppointment(new Date(Date.now() - 26 * 60 * 60_000));
    const { error } = await userA.rpc('mark_appointment_no_show', {
      p_appointment_id: appointmentId,
    });
    expect(error).toBeNull();

    const appointment = await admin
      .from('appointments')
      .select('status')
      .eq('id', appointmentId)
      .single();
    expect(appointment.data?.status).toBe('no_show');

    const audit = await admin
      .from('audit_logs')
      .select('action, resource_type, actor_user_id')
      .eq('resource_id', appointmentId)
      .eq('action', 'appointment.no_show_marked')
      .single();
    expect(audit.data).toMatchObject({
      action: 'appointment.no_show_marked',
      resource_type: 'appointment',
      actor_user_id: userAId,
    });
  });

  it('rejects marking an already-cancelled appointment', async () => {
    const appointmentId = await seedAppointment(new Date(Date.now() - 27 * 60 * 60_000));
    const cancel = await userA.rpc('cancel_appointment', { p_appointment_id: appointmentId });
    expect(cancel.error).toBeNull();

    const { error } = await userA.rpc('mark_appointment_no_show', {
      p_appointment_id: appointmentId,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('22023');
  });

  it('rejects marking an appointment already marked no_show', async () => {
    const appointmentId = await seedAppointment(new Date(Date.now() - 28 * 60 * 60_000));
    const first = await userA.rpc('mark_appointment_no_show', {
      p_appointment_id: appointmentId,
    });
    expect(first.error).toBeNull();

    const second = await userA.rpc('mark_appointment_no_show', {
      p_appointment_id: appointmentId,
    });
    expect(second.error).not.toBeNull();
    expect(second.error?.code).toBe('22023');
  });
});
