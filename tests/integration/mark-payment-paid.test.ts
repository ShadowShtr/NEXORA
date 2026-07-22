import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Exercises mark_payment_paid (NEX-114, supabase/migrations/0029_mark_payment_paid.sql)
// through the same PostgREST boundary the app uses. Requires the same env vars as
// publish-business.test.ts; skips cleanly when unset.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

function bookingTokenHash(seed: string) {
  return seed.padEnd(64, '0').slice(0, 64);
}

describe.runIf(canRun)('mark_payment_paid (NEX-114)', () => {
  let admin: SupabaseClient;
  let userA: SupabaseClient;
  let userB: SupabaseClient;

  const tenantAId = randomUUID();
  const tenantBId = randomUUID();
  const emailA = `nex114-a-${randomUUID()}@example.test`;
  const emailB = `nex114-b-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}!`;
  let userAId: string;
  let userBId: string;
  const slugA = `nex114-a-${tenantAId.slice(0, 8)}`;
  const slugB = `nex114-b-${tenantBId.slice(0, 8)}`;
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
      .insert({ tenant_id: tenantAId, name: 'Client A', phone_e164: '+351910000041' })
      .select('id')
      .single();
    clientAId = client!.id;
  });

  afterAll(async () => {
    await admin.from('tenants').update({ status: 'deleted' }).in('id', [tenantAId, tenantBId]);
    await admin.auth.admin.deleteUser(userAId);
    await admin.auth.admin.deleteUser(userBId);
  });

  async function seedPendingPayment(amountCents: number) {
    const appointmentId = randomUUID();
    const startAt = new Date(Date.now() + 50 * 60 * 60_000);
    const endAt = new Date(startAt.getTime() + 60 * 60_000);
    const { error: apptError } = await admin.from('appointments').insert({
      id: appointmentId,
      tenant_id: tenantAId,
      client_id: clientAId,
      source: 'admin',
      status: 'completed',
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      blocked_until: new Date(endAt.getTime() + 15 * 60_000).toISOString(),
      expected_total_cents: amountCents,
      final_total_cents: amountCents,
      completed_at: new Date().toISOString(),
      booking_token_hash: bookingTokenHash(appointmentId),
    });
    if (apptError) throw apptError;

    const { data: payment, error: paymentError } = await admin
      .from('payments')
      .insert({
        tenant_id: tenantAId,
        appointment_id: appointmentId,
        status: 'pending',
        amount_cents: amountCents,
      })
      .select('id')
      .single();
    if (paymentError) throw paymentError;
    return payment!.id as string;
  }

  it('is not callable by anon', async () => {
    const anon = createClient(url!, publishableKey!);
    const paymentId = await seedPendingPayment(2000);
    const { error } = await anon.rpc('mark_payment_paid', {
      p_payment_id: paymentId,
      p_method: 'cash',
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it("rejects marking another tenant's payment as paid", async () => {
    const paymentId = await seedPendingPayment(2500);
    const { error } = await userB.rpc('mark_payment_paid', {
      p_payment_id: paymentId,
      p_method: 'cash',
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('22023');
  });

  it('moves pending -> paid, sets method and paid_at, and writes one audit log entry', async () => {
    const paymentId = await seedPendingPayment(3000);

    const { error } = await userA.rpc('mark_payment_paid', {
      p_payment_id: paymentId,
      p_method: 'mbway',
    });
    expect(error).toBeNull();

    const payment = await admin
      .from('payments')
      .select('status, method, paid_at, amount_cents')
      .eq('id', paymentId)
      .single();
    expect(payment.data?.status).toBe('paid');
    expect(payment.data?.method).toBe('mbway');
    expect(payment.data?.paid_at).not.toBeNull();
    expect(payment.data?.amount_cents).toBe(3000);

    const audit = await admin
      .from('audit_logs')
      .select('id, action, metadata')
      .eq('resource_id', paymentId)
      .eq('action', 'payment.marked_paid');
    expect(audit.data).toHaveLength(1);
    expect(audit.data?.[0]?.metadata).toMatchObject({ method: 'mbway', amount_cents: 3000 });
  });

  it('rejects marking an already-paid payment as paid again', async () => {
    const paymentId = await seedPendingPayment(1500);
    const first = await userA.rpc('mark_payment_paid', {
      p_payment_id: paymentId,
      p_method: 'cash',
    });
    expect(first.error).toBeNull();

    const second = await userA.rpc('mark_payment_paid', {
      p_payment_id: paymentId,
      p_method: 'mbway',
    });
    expect(second.error).not.toBeNull();
    expect(second.error?.code).toBe('22023');

    const payment = await admin.from('payments').select('method').eq('id', paymentId).single();
    expect(payment.data?.method).toBe('cash');
  });
});
