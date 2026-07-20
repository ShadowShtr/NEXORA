import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Exercises the discount parameters added to complete_appointment (NEX-112,
// supabase/migrations/0017_complete_appointment_discount.sql). Requires the same env
// vars as publish-business.test.ts; skips cleanly when unset.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

function bookingTokenHash(seed: string) {
  return seed.padEnd(64, '0').slice(0, 64);
}

describe.runIf(canRun)('complete_appointment discount (NEX-112)', () => {
  let admin: SupabaseClient;
  let userA: SupabaseClient;

  const tenantId = randomUUID();
  const email = `nex112-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}!`;
  let userId: string;
  const slug = `nex112-${tenantId.slice(0, 8)}`;
  let clientId: string;

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
      .insert({ tenant_id: tenantId, name: 'Client', phone_e164: '+351910000070' })
      .select('id')
      .single();
    clientId = client!.id;
  });

  afterAll(async () => {
    await admin.from('tenants').delete().eq('id', tenantId);
    await admin.auth.admin.deleteUser(userId);
  });

  async function seedAppointment(startAt: Date) {
    const endAt = new Date(startAt.getTime() + 60 * 60_000);
    const id = randomUUID();
    await admin.from('appointments').insert({
      id,
      tenant_id: tenantId,
      client_id: clientId,
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

  it('applies a fixed discount as a negative appointment_item with the reason appended', async () => {
    const appointmentId = await seedAppointment(new Date(Date.now() - 60 * 60_000));
    const { error } = await userA.rpc('complete_appointment', {
      p_appointment_id: appointmentId,
      p_final_total_cents: 2500,
      p_payment_status: 'paid',
      p_payment_method: 'cash',
      p_extra_service_ids: null,
      p_manual_extras: null,
      p_discount_type: 'fixed',
      p_discount_value: 500,
      p_discount_reason: 'Cliente fiel',
    });
    expect(error).toBeNull();

    const items = await admin
      .from('appointment_items')
      .select('source_type, source_id, description, unit_price_cents')
      .eq('appointment_id', appointmentId);
    expect(items.data).toEqual([
      {
        source_type: 'discount',
        source_id: null,
        description: 'Desconto — Cliente fiel',
        unit_price_cents: -500,
      },
    ]);
  });

  it('applies a percent discount computed against the final total, with no reason appended when omitted', async () => {
    const appointmentId = await seedAppointment(new Date(Date.now() - 61 * 60_000));
    const { error } = await userA.rpc('complete_appointment', {
      p_appointment_id: appointmentId,
      p_final_total_cents: 2000,
      p_payment_status: 'paid',
      p_payment_method: 'cash',
      p_extra_service_ids: null,
      p_manual_extras: null,
      p_discount_type: 'percent',
      p_discount_value: 10,
      p_discount_reason: null,
    });
    expect(error).toBeNull();

    const item = await admin
      .from('appointment_items')
      .select('description, unit_price_cents')
      .eq('appointment_id', appointmentId)
      .single();
    // 10% of 2000 = 200.
    expect(item.data?.unit_price_cents).toBe(-200);
    expect(item.data?.description).not.toContain('—');
  });

  it('clamps a fixed discount larger than the final total to exactly the final total (never negative)', async () => {
    const appointmentId = await seedAppointment(new Date(Date.now() - 62 * 60_000));
    const { error } = await userA.rpc('complete_appointment', {
      p_appointment_id: appointmentId,
      p_final_total_cents: 1000,
      p_payment_status: 'paid',
      p_payment_method: 'cash',
      p_extra_service_ids: null,
      p_manual_extras: null,
      p_discount_type: 'fixed',
      p_discount_value: 999999,
      p_discount_reason: null,
    });
    expect(error).toBeNull();

    const item = await admin
      .from('appointment_items')
      .select('unit_price_cents')
      .eq('appointment_id', appointmentId)
      .single();
    expect(item.data?.unit_price_cents).toBe(-1000);
  });

  it('rejects a percent discount above 100, rolling back the whole completion', async () => {
    const appointmentId = await seedAppointment(new Date(Date.now() - 63 * 60_000));
    const { error } = await userA.rpc('complete_appointment', {
      p_appointment_id: appointmentId,
      p_final_total_cents: 1000,
      p_payment_status: 'paid',
      p_payment_method: 'cash',
      p_extra_service_ids: null,
      p_manual_extras: null,
      p_discount_type: 'percent',
      p_discount_value: 150,
      p_discount_reason: null,
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

  it('rejects a zero or negative discount value', async () => {
    const appointmentId = await seedAppointment(new Date(Date.now() - 64 * 60_000));
    const { error } = await userA.rpc('complete_appointment', {
      p_appointment_id: appointmentId,
      p_final_total_cents: 1000,
      p_payment_status: 'paid',
      p_payment_method: 'cash',
      p_extra_service_ids: null,
      p_manual_extras: null,
      p_discount_type: 'fixed',
      p_discount_value: 0,
      p_discount_reason: null,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('22023');
  });

  it('rejects an invalid discount type', async () => {
    const appointmentId = await seedAppointment(new Date(Date.now() - 65 * 60_000));
    const { error } = await userA.rpc('complete_appointment', {
      p_appointment_id: appointmentId,
      p_final_total_cents: 1000,
      p_payment_status: 'paid',
      p_payment_method: 'cash',
      p_extra_service_ids: null,
      p_manual_extras: null,
      p_discount_type: 'coupon',
      p_discount_value: 10,
      p_discount_reason: null,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('22023');
  });

  it('rejects a discount reason longer than 200 characters', async () => {
    const appointmentId = await seedAppointment(new Date(Date.now() - 66 * 60_000));
    const { error } = await userA.rpc('complete_appointment', {
      p_appointment_id: appointmentId,
      p_final_total_cents: 1000,
      p_payment_status: 'paid',
      p_payment_method: 'cash',
      p_extra_service_ids: null,
      p_manual_extras: null,
      p_discount_type: 'fixed',
      p_discount_value: 100,
      p_discount_reason: 'a'.repeat(201),
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('22023');
  });

  it('completes with no discount (backward compatible with omitted discount params)', async () => {
    const appointmentId = await seedAppointment(new Date(Date.now() - 67 * 60_000));
    const { error } = await userA.rpc('complete_appointment', {
      p_appointment_id: appointmentId,
      p_final_total_cents: 2500,
      p_payment_status: 'paid',
      p_payment_method: 'cash',
    });
    expect(error).toBeNull();

    const items = await admin
      .from('appointment_items')
      .select('id')
      .eq('appointment_id', appointmentId);
    expect(items.data).toHaveLength(0);
  });
});
