import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Exercises cancel_appointment/reschedule_appointment (NEX-084,
// supabase/migrations/0008_cancel_reschedule_appointment.sql) through the same
// PostgREST boundary the app uses. Requires the same env vars as
// publish-business.test.ts; skips cleanly when unset.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

function bookingTokenHash(seed: string) {
  return seed.padEnd(64, '0').slice(0, 64);
}

describe.runIf(canRun)('cancel_appointment / reschedule_appointment (NEX-084)', () => {
  let admin: SupabaseClient;
  let userA: SupabaseClient;
  let userB: SupabaseClient;

  const tenantAId = randomUUID();
  const tenantBId = randomUUID();
  const emailA = `nex084-a-${randomUUID()}@example.test`;
  const emailB = `nex084-b-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}!`;
  let userAId: string;
  let userBId: string;
  const slugA = `nex084-a-${tenantAId.slice(0, 8)}`;
  const slugB = `nex084-b-${tenantBId.slice(0, 8)}`;
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
      .insert({ tenant_id: tenantAId, name: 'Client A', phone_e164: '+351910000010' })
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
    const appointmentId = await seedAppointment(new Date(Date.now() + 24 * 60 * 60_000));
    const { error } = await anon.rpc('cancel_appointment', { p_appointment_id: appointmentId });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it("rejects cancelling another tenant's appointment", async () => {
    const appointmentId = await seedAppointment(new Date(Date.now() + 25 * 60 * 60_000));
    const { error } = await userB.rpc('cancel_appointment', { p_appointment_id: appointmentId });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('22023');

    const still = await admin
      .from('appointments')
      .select('status')
      .eq('id', appointmentId)
      .single();
    expect(still.data?.status).toBe('confirmed');
  });

  it("cancels the caller's own appointment and writes an audit log entry", async () => {
    const appointmentId = await seedAppointment(new Date(Date.now() + 26 * 60 * 60_000));
    const { error } = await userA.rpc('cancel_appointment', { p_appointment_id: appointmentId });
    expect(error).toBeNull();

    const appointment = await admin
      .from('appointments')
      .select('status, cancelled_at')
      .eq('id', appointmentId)
      .single();
    expect(appointment.data?.status).toBe('cancelled');
    expect(appointment.data?.cancelled_at).not.toBeNull();

    const audit = await admin
      .from('audit_logs')
      .select('action, resource_type, actor_user_id')
      .eq('resource_id', appointmentId)
      .eq('action', 'appointment.cancelled')
      .single();
    expect(audit.data).toMatchObject({
      action: 'appointment.cancelled',
      resource_type: 'appointment',
      actor_user_id: userAId,
    });
  });

  it('rejects cancelling an already-cancelled appointment', async () => {
    const appointmentId = await seedAppointment(new Date(Date.now() + 27 * 60 * 60_000));
    const first = await userA.rpc('cancel_appointment', { p_appointment_id: appointmentId });
    expect(first.error).toBeNull();

    const second = await userA.rpc('cancel_appointment', { p_appointment_id: appointmentId });
    expect(second.error).not.toBeNull();
    expect(second.error?.code).toBe('22023');
  });

  it('reschedules to a free slot, preserving duration and writing an audit log entry', async () => {
    const originalStart = new Date(Date.now() + 30 * 60 * 60_000);
    const appointmentId = await seedAppointment(originalStart);
    const newStart = new Date(Date.now() + 48 * 60 * 60_000);

    const { error } = await userA.rpc('reschedule_appointment', {
      p_appointment_id: appointmentId,
      p_new_start_at: newStart.toISOString(),
    });
    expect(error).toBeNull();

    const appointment = await admin
      .from('appointments')
      .select('start_at, end_at, blocked_until')
      .eq('id', appointmentId)
      .single();
    expect(new Date(appointment.data!.start_at).getTime()).toBe(newStart.getTime());
    // Original duration (60 min) preserved.
    expect(
      new Date(appointment.data!.end_at).getTime() - new Date(appointment.data!.start_at).getTime(),
    ).toBe(60 * 60_000);

    const audit = await admin
      .from('audit_logs')
      .select('action')
      .eq('resource_id', appointmentId)
      .eq('action', 'appointment.rescheduled')
      .single();
    expect(audit.data?.action).toBe('appointment.rescheduled');
  });

  it('rejects rescheduling onto a slot already occupied by another active appointment (conflict)', async () => {
    const takenStart = new Date(Date.now() + 60 * 60 * 60_000);
    await seedAppointment(takenStart);
    const appointmentId = await seedAppointment(new Date(Date.now() + 62 * 60 * 60_000));

    const { error } = await userA.rpc('reschedule_appointment', {
      p_appointment_id: appointmentId,
      p_new_start_at: takenStart.toISOString(),
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23P01');

    // The appointment being rescheduled must be untouched by the failed attempt.
    const appointment = await admin
      .from('appointments')
      .select('start_at')
      .eq('id', appointmentId)
      .single();
    expect(new Date(appointment.data!.start_at).getTime()).not.toBe(takenStart.getTime());
  });

  it("rejects rescheduling another tenant's appointment", async () => {
    const appointmentId = await seedAppointment(new Date(Date.now() + 70 * 60 * 60_000));
    const { error } = await userB.rpc('reschedule_appointment', {
      p_appointment_id: appointmentId,
      p_new_start_at: new Date(Date.now() + 72 * 60 * 60_000).toISOString(),
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('22023');
  });
});
