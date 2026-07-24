import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Exercises reopen_appointment (NEX-115, supabase/migrations/0031_reopen_appointment.sql)
// through the same PostgREST boundary the app uses. Requires the same env vars as
// publish-business.test.ts; skips cleanly when unset.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

describe.runIf(canRun)('reopen_appointment (NEX-115)', () => {
  let admin: SupabaseClient;
  let userA: SupabaseClient;
  let userB: SupabaseClient;

  const tenantAId = randomUUID();
  const tenantBId = randomUUID();
  const emailA = `nex115-a-${randomUUID()}@example.test`;
  const emailB = `nex115-b-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}!`;
  let userAId: string;
  let userBId: string;
  const slugA = `nex115-a-${tenantAId.slice(0, 8)}`;
  const slugB = `nex115-b-${tenantBId.slice(0, 8)}`;
  let clientAId: string;
  let categoryId: string;
  let serviceId: string;
  let extraServiceId: string;

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
      .insert({ tenant_id: tenantAId, name: 'Client A', phone_e164: '+351910000115' })
      .select('id')
      .single();
    clientAId = client!.id;

    const { data: category } = await admin
      .from('service_categories')
      .insert({ tenant_id: tenantAId, name: 'Unhas', sort_order: 0 })
      .select('id')
      .single();
    categoryId = category!.id;

    const { data: service } = await admin
      .from('services')
      .insert({
        tenant_id: tenantAId,
        category_id: categoryId,
        name: 'Verniz Gel',
        price_cents: 1500,
        duration_minutes: 30,
        is_active: true,
      })
      .select('id')
      .single();
    serviceId = service!.id;

    const { data: extraService } = await admin
      .from('services')
      .insert({
        tenant_id: tenantAId,
        category_id: categoryId,
        name: 'Correção de unha',
        price_cents: 500,
        duration_minutes: 15,
        is_active: true,
      })
      .select('id')
      .single();
    extraServiceId = extraService!.id;
  });

  afterAll(async () => {
    await admin.from('tenants').update({ status: 'deleted' }).in('id', [tenantAId, tenantBId]);
    await admin.auth.admin.deleteUser(userAId);
    await admin.auth.admin.deleteUser(userBId);
  });

  // Books through create_manual_booking (not a direct appointments insert) so the
  // original appointment_item is created in the exact same transaction as the
  // appointment row itself — the invariant reopen_appointment's created_at filter
  // relies on to tell "booked with" apart from "added at completion".
  async function bookAppointment(startAt: Date) {
    const { data: appointmentId, error } = await userA.rpc('create_manual_booking', {
      p_client_id: clientAId,
      p_client_name: null,
      p_client_phone_e164: null,
      p_client_email: null,
      p_selected_service_ids: [serviceId],
      p_selected_package_id: null,
      p_start_at: startAt.toISOString(),
      p_client_observation: null,
    });
    if (error) throw error;
    return appointmentId as string;
  }

  async function completeWithExtras(appointmentId: string) {
    const { error } = await userA.rpc('complete_appointment', {
      p_appointment_id: appointmentId,
      p_final_total_cents: 2200,
      p_payment_status: 'paid',
      p_payment_method: 'cash',
      p_extra_service_ids: [extraServiceId],
      p_manual_extras: [{ description: 'Brilho extra', unitPriceCents: 200 }],
      p_discount_type: 'fixed',
      p_discount_value: 500,
      p_discount_reason: 'Cliente fiel',
    });
    if (error) throw error;
  }

  it('is not callable by anon', async () => {
    const anon = createClient(url!, publishableKey!);
    const appointmentId = await bookAppointment(new Date(Date.now() + 24 * 60 * 60_000));
    await completeWithExtras(appointmentId);

    const { error } = await anon.rpc('reopen_appointment', { p_appointment_id: appointmentId });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it("rejects reopening another tenant's appointment, leaving it untouched", async () => {
    const appointmentId = await bookAppointment(new Date(Date.now() + 26 * 60 * 60_000));
    await completeWithExtras(appointmentId);

    const { error } = await userB.rpc('reopen_appointment', { p_appointment_id: appointmentId });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('22023');

    const appointment = await admin
      .from('appointments')
      .select('status')
      .eq('id', appointmentId)
      .single();
    expect(appointment.data?.status).toBe('completed');
  });

  it('rejects reopening an appointment that was never completed', async () => {
    const appointmentId = await bookAppointment(new Date(Date.now() + 28 * 60 * 60_000));

    const { error } = await userA.rpc('reopen_appointment', { p_appointment_id: appointmentId });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('22023');
  });

  it('reverts status, removes only completion-added items, keeps the original booking item, refunds the payment, and audits the prior state', async () => {
    const appointmentId = await bookAppointment(new Date(Date.now() + 30 * 60 * 60_000));
    await completeWithExtras(appointmentId);

    const beforeItems = await admin
      .from('appointment_items')
      .select('source_type')
      .eq('appointment_id', appointmentId);
    expect(beforeItems.data).toHaveLength(4); // original service + extra service + manual_extra + discount

    const { error } = await userA.rpc('reopen_appointment', { p_appointment_id: appointmentId });
    expect(error).toBeNull();

    const appointment = await admin
      .from('appointments')
      .select('status, completed_at, final_total_cents')
      .eq('id', appointmentId)
      .single();
    expect(appointment.data).toMatchObject({
      status: 'confirmed',
      completed_at: null,
      final_total_cents: null,
    });

    const items = await admin
      .from('appointment_items')
      .select('source_type, source_id, description, unit_price_cents')
      .eq('appointment_id', appointmentId);
    // Only the original booking item survives — the catalog-service extra added via
    // p_extra_service_ids shares source_type='service' with it, so this also proves the
    // removal isn't just filtering by source_type.
    expect(items.data).toEqual([
      {
        source_type: 'service',
        source_id: serviceId,
        description: 'Verniz Gel',
        unit_price_cents: 1500,
      },
    ]);

    const payment = await admin
      .from('payments')
      .select('status')
      .eq('appointment_id', appointmentId)
      .single();
    expect(payment.data?.status).toBe('refunded');

    const audit = await admin
      .from('audit_logs')
      .select('action, resource_type, actor_user_id, metadata')
      .eq('resource_id', appointmentId)
      .eq('action', 'appointment.reopened')
      .single();
    expect(audit.data).toMatchObject({
      action: 'appointment.reopened',
      resource_type: 'appointment',
      actor_user_id: userAId,
    });
    expect(audit.data?.metadata).toMatchObject({
      previous_status: 'completed',
      previous_final_total_cents: 2200,
      previous_payment_status: 'paid',
    });
    expect(audit.data?.metadata.removed_items).toHaveLength(3);
  });

  it('rejects reopening an appointment that was already reopened', async () => {
    const appointmentId = await bookAppointment(new Date(Date.now() + 32 * 60 * 60_000));
    await completeWithExtras(appointmentId);

    const first = await userA.rpc('reopen_appointment', { p_appointment_id: appointmentId });
    expect(first.error).toBeNull();

    const second = await userA.rpc('reopen_appointment', { p_appointment_id: appointmentId });
    expect(second.error).not.toBeNull();
    expect(second.error?.code).toBe('22023');
  });
});
