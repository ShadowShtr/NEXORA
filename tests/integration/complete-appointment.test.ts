import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Exercises complete_appointment (NEX-110/NEX-113,
// supabase/migrations/0015_complete_appointment.sql) through the same PostgREST
// boundary the app uses. Requires the same env vars as publish-business.test.ts; skips
// cleanly when unset.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

function bookingTokenHash(seed: string) {
  return seed.padEnd(64, '0').slice(0, 64);
}

describe.runIf(canRun)('complete_appointment (NEX-110/NEX-113)', () => {
  let admin: SupabaseClient;
  let userA: SupabaseClient;
  let userB: SupabaseClient;

  const tenantAId = randomUUID();
  const tenantBId = randomUUID();
  const emailA = `nex110-a-${randomUUID()}@example.test`;
  const emailB = `nex110-b-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}!`;
  let userAId: string;
  let userBId: string;
  const slugA = `nex110-a-${tenantAId.slice(0, 8)}`;
  const slugB = `nex110-b-${tenantBId.slice(0, 8)}`;
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
      .insert({ tenant_id: tenantAId, name: 'Client A', phone_e164: '+351910000050' })
      .select('id')
      .single();
    clientAId = client!.id;
  });

  afterAll(async () => {
    await admin.from('tenants').delete().in('id', [tenantAId, tenantBId]);
    await admin.auth.admin.deleteUser(userAId);
    await admin.auth.admin.deleteUser(userBId);
  });

  async function seedAppointment(startAt: Date, expectedTotalCents = 2500) {
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
      expected_total_cents: expectedTotalCents,
      booking_token_hash: bookingTokenHash(id),
    });
    return id;
  }

  it('is not callable by anon', async () => {
    const anon = createClient(url!, publishableKey!);
    const appointmentId = await seedAppointment(new Date(Date.now() - 60 * 60_000));
    const { error } = await anon.rpc('complete_appointment', {
      p_appointment_id: appointmentId,
      p_final_total_cents: 2500,
      p_payment_status: 'paid',
      p_payment_method: 'cash',
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it("rejects completing another tenant's appointment", async () => {
    const appointmentId = await seedAppointment(new Date(Date.now() - 61 * 60_000));
    const { error } = await userB.rpc('complete_appointment', {
      p_appointment_id: appointmentId,
      p_final_total_cents: 2500,
      p_payment_status: 'paid',
      p_payment_method: 'cash',
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('22023');
  });

  it('completes with cash payment, updating appointment/payment/audit atomically', async () => {
    const appointmentId = await seedAppointment(new Date(Date.now() - 62 * 60_000), 3000);
    const { error } = await userA.rpc('complete_appointment', {
      p_appointment_id: appointmentId,
      p_final_total_cents: 3500,
      p_payment_status: 'paid',
      p_payment_method: 'cash',
    });
    expect(error).toBeNull();

    const appointment = await admin
      .from('appointments')
      .select('status, final_total_cents, completed_at')
      .eq('id', appointmentId)
      .single();
    expect(appointment.data?.status).toBe('completed');
    expect(appointment.data?.final_total_cents).toBe(3500);
    expect(appointment.data?.completed_at).not.toBeNull();

    const payment = await admin
      .from('payments')
      .select('method, status, amount_cents, paid_at')
      .eq('appointment_id', appointmentId)
      .single();
    expect(payment.data).toMatchObject({ method: 'cash', status: 'paid', amount_cents: 3500 });
    expect(payment.data?.paid_at).not.toBeNull();

    const audit = await admin
      .from('audit_logs')
      .select('action, resource_type, actor_user_id, metadata')
      .eq('resource_id', appointmentId)
      .eq('action', 'appointment.completed')
      .single();
    expect(audit.data).toMatchObject({
      action: 'appointment.completed',
      resource_type: 'appointment',
      actor_user_id: userAId,
    });
    expect(audit.data?.metadata).toMatchObject({
      expected_total_cents: 3000,
      final_total_cents: 3500,
      payment_status: 'paid',
    });
  });

  it('completes as pending with no method and no paid_at', async () => {
    const appointmentId = await seedAppointment(new Date(Date.now() - 63 * 60_000));
    const { error } = await userA.rpc('complete_appointment', {
      p_appointment_id: appointmentId,
      p_final_total_cents: 2500,
      p_payment_status: 'pending',
      p_payment_method: null,
    });
    expect(error).toBeNull();

    const payment = await admin
      .from('payments')
      .select('method, status, paid_at')
      .eq('appointment_id', appointmentId)
      .single();
    expect(payment.data).toMatchObject({ method: null, status: 'pending', paid_at: null });
  });

  it('rejects a negative final total, leaving the appointment untouched (rollback)', async () => {
    const appointmentId = await seedAppointment(new Date(Date.now() - 64 * 60_000));
    const { error } = await userA.rpc('complete_appointment', {
      p_appointment_id: appointmentId,
      p_final_total_cents: -100,
      p_payment_status: 'paid',
      p_payment_method: 'cash',
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('22023');

    const appointment = await admin
      .from('appointments')
      .select('status')
      .eq('id', appointmentId)
      .single();
    expect(appointment.data?.status).toBe('confirmed');
    const payments = await admin.from('payments').select('id').eq('appointment_id', appointmentId);
    expect(payments.data).toHaveLength(0);
  });

  it('rejects a paid status with a null method (rollback, nothing partially written)', async () => {
    const appointmentId = await seedAppointment(new Date(Date.now() - 65 * 60_000));
    const { error } = await userA.rpc('complete_appointment', {
      p_appointment_id: appointmentId,
      p_final_total_cents: 2500,
      p_payment_status: 'paid',
      p_payment_method: null,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('22023');

    const appointment = await admin
      .from('appointments')
      .select('status')
      .eq('id', appointmentId)
      .single();
    expect(appointment.data?.status).toBe('confirmed');
  });

  it('rejects completing an already-completed appointment (no duplicate payment on retry)', async () => {
    const appointmentId = await seedAppointment(new Date(Date.now() - 66 * 60_000));
    const first = await userA.rpc('complete_appointment', {
      p_appointment_id: appointmentId,
      p_final_total_cents: 2500,
      p_payment_status: 'paid',
      p_payment_method: 'cash',
    });
    expect(first.error).toBeNull();

    const retry = await userA.rpc('complete_appointment', {
      p_appointment_id: appointmentId,
      p_final_total_cents: 2500,
      p_payment_status: 'paid',
      p_payment_method: 'cash',
    });
    expect(retry.error).not.toBeNull();
    expect(retry.error?.code).toBe('22023');

    const payments = await admin.from('payments').select('id').eq('appointment_id', appointmentId);
    expect(payments.data).toHaveLength(1);
  });

  it('rejects starting a completion as refunded', async () => {
    const appointmentId = await seedAppointment(new Date(Date.now() - 67 * 60_000));
    const { error } = await userA.rpc('complete_appointment', {
      p_appointment_id: appointmentId,
      p_final_total_cents: 2500,
      p_payment_status: 'refunded',
      p_payment_method: 'cash',
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('22023');
  });
});
