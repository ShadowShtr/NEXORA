import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Exercises the extras parameters added to complete_appointment (NEX-111,
// supabase/migrations/0016_complete_appointment_extras.sql). Requires the same env
// vars as publish-business.test.ts; skips cleanly when unset.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

function bookingTokenHash(seed: string) {
  return seed.padEnd(64, '0').slice(0, 64);
}

describe.runIf(canRun)('complete_appointment extras (NEX-111)', () => {
  let admin: SupabaseClient;
  let userA: SupabaseClient;

  const tenantId = randomUUID();
  const email = `nex111-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}!`;
  let userId: string;
  const slug = `nex111-${tenantId.slice(0, 8)}`;
  let clientId: string;
  let categoryId: string;
  let serviceId: string;
  let inactiveServiceId: string;

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
      .insert({ tenant_id: tenantId, name: 'Client', phone_e164: '+351910000060' })
      .select('id')
      .single();
    clientId = client!.id;

    const { data: category } = await admin
      .from('service_categories')
      .insert({ tenant_id: tenantId, name: 'Unhas', sort_order: 0 })
      .select('id')
      .single();
    categoryId = category!.id;

    const { data: service } = await admin
      .from('services')
      .insert({
        tenant_id: tenantId,
        category_id: categoryId,
        name: 'Verniz Gel',
        price_cents: 1500,
        duration_minutes: 30,
        is_active: true,
      })
      .select('id')
      .single();
    serviceId = service!.id;

    const { data: inactiveService } = await admin
      .from('services')
      .insert({
        tenant_id: tenantId,
        category_id: categoryId,
        name: 'Descontinuado',
        price_cents: 999,
        duration_minutes: 15,
        is_active: false,
      })
      .select('id')
      .single();
    inactiveServiceId = inactiveService!.id;
  });

  afterAll(async () => {
    await admin.from('tenants').update({ status: 'deleted' }).eq('id', tenantId);
    await admin.auth.admin.deleteUser(userId);
  });

  async function seedAppointment(startAt: Date) {
    const endAt = new Date(startAt.getTime() + 60 * 60_000);
    const id = randomUUID();
    const { error } = await admin.from('appointments').insert({
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
    if (error) throw error;
    return id;
  }

  it('adds a catalog service extra, re-priced from the live catalog as a snapshot appointment_item', async () => {
    // Tamper the client-provided price to prove the RPC never trusts it: the actual
    // catalog price (1500) is what must land in appointment_items, not whatever the
    // final total implies.
    const appointmentId = await seedAppointment(new Date(Date.now() - 2 * 60 * 60_000));
    const { error } = await userA.rpc('complete_appointment', {
      p_appointment_id: appointmentId,
      p_final_total_cents: 4000,
      p_payment_status: 'paid',
      p_payment_method: 'cash',
      p_extra_service_ids: [serviceId],
      p_manual_extras: null,
    });
    expect(error).toBeNull();

    const items = await admin
      .from('appointment_items')
      .select('source_type, source_id, description, unit_price_cents')
      .eq('appointment_id', appointmentId);
    expect(items.data).toEqual([
      {
        source_type: 'service',
        source_id: serviceId,
        description: 'Verniz Gel',
        unit_price_cents: 1500,
      },
    ]);
  });

  it('ignores an inactive service id rather than adding a stale extra', async () => {
    const appointmentId = await seedAppointment(new Date(Date.now() - 4 * 60 * 60_000));
    const { error } = await userA.rpc('complete_appointment', {
      p_appointment_id: appointmentId,
      p_final_total_cents: 2500,
      p_payment_status: 'paid',
      p_payment_method: 'cash',
      p_extra_service_ids: [inactiveServiceId],
      p_manual_extras: null,
    });
    expect(error).toBeNull();

    const items = await admin
      .from('appointment_items')
      .select('id')
      .eq('appointment_id', appointmentId);
    expect(items.data).toHaveLength(0);
  });

  it('adds a manual extra with an owner-typed description and price', async () => {
    const appointmentId = await seedAppointment(new Date(Date.now() - 6 * 60 * 60_000));
    const { error } = await userA.rpc('complete_appointment', {
      p_appointment_id: appointmentId,
      p_final_total_cents: 3000,
      p_payment_status: 'paid',
      p_payment_method: 'mbway',
      p_extra_service_ids: null,
      p_manual_extras: [{ description: 'Correção de unha', unitPriceCents: 500 }],
    });
    expect(error).toBeNull();

    const items = await admin
      .from('appointment_items')
      .select('source_type, source_id, description, unit_price_cents')
      .eq('appointment_id', appointmentId);
    expect(items.data).toEqual([
      {
        source_type: 'manual_extra',
        source_id: null,
        description: 'Correção de unha',
        unit_price_cents: 500,
      },
    ]);
  });

  it('rejects a manual extra with a negative price, rolling back the whole completion', async () => {
    const appointmentId = await seedAppointment(new Date(Date.now() - 8 * 60 * 60_000));
    const { error } = await userA.rpc('complete_appointment', {
      p_appointment_id: appointmentId,
      p_final_total_cents: 3000,
      p_payment_status: 'paid',
      p_payment_method: 'cash',
      p_extra_service_ids: null,
      p_manual_extras: [{ description: 'Ajuste', unitPriceCents: -100 }],
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

  it('rejects a manual extra with an empty description', async () => {
    const appointmentId = await seedAppointment(new Date(Date.now() - 10 * 60 * 60_000));
    const { error } = await userA.rpc('complete_appointment', {
      p_appointment_id: appointmentId,
      p_final_total_cents: 3000,
      p_payment_status: 'paid',
      p_payment_method: 'cash',
      p_extra_service_ids: null,
      p_manual_extras: [{ description: '   ', unitPriceCents: 500 }],
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('22023');
  });

  it('combines a service extra and a manual extra with the completion payment in one transaction', async () => {
    const appointmentId = await seedAppointment(new Date(Date.now() - 12 * 60 * 60_000));
    const { error } = await userA.rpc('complete_appointment', {
      p_appointment_id: appointmentId,
      p_final_total_cents: 4500,
      p_payment_status: 'paid',
      p_payment_method: 'cash',
      p_extra_service_ids: [serviceId],
      p_manual_extras: [{ description: 'Brilho extra', unitPriceCents: 200 }],
    });
    expect(error).toBeNull();

    const items = await admin
      .from('appointment_items')
      .select('source_type')
      .eq('appointment_id', appointmentId);
    expect(items.data).toHaveLength(2);

    const payment = await admin
      .from('payments')
      .select('amount_cents')
      .eq('appointment_id', appointmentId)
      .single();
    expect(payment.data?.amount_cents).toBe(4500);
  });
});
