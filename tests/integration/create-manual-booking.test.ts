import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Exercises create_manual_booking (NEX-085,
// supabase/migrations/0009_create_manual_booking.sql) through the same PostgREST
// boundary the app uses. Requires the same env vars as publish-business.test.ts; skips
// cleanly when unset.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

describe.runIf(canRun)('create_manual_booking (NEX-085)', () => {
  let admin: SupabaseClient;
  let owner: SupabaseClient;

  const tenantId = randomUUID();
  const email = `nex085-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}!`;
  let ownerId: string;
  const slug = `nex085-${tenantId.slice(0, 8)}`;
  const categoryId = randomUUID();
  const serviceId = randomUUID();
  let existingClientId: string;

  beforeAll(async () => {
    admin = createClient(url!, serviceRoleKey!);
    owner = createClient(url!, publishableKey!);

    await admin
      .from('tenants')
      .insert({ id: tenantId, slug, name: 'Manual Booking Tenant', status: 'active' });
    await admin.from('business_settings').insert({ tenant_id: tenantId, buffer_minutes: 15 });

    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error) throw created.error;
    ownerId = created.data.user.id;
    await admin
      .from('profiles')
      .insert({ user_id: ownerId, tenant_id: tenantId, role: 'owner', display_name: 'Owner' });

    const signIn = await owner.auth.signInWithPassword({ email, password });
    if (signIn.error) throw signIn.error;

    await admin
      .from('service_categories')
      .insert({ id: categoryId, tenant_id: tenantId, name: 'Manicure' });
    await admin.from('services').insert({
      id: serviceId,
      tenant_id: tenantId,
      category_id: categoryId,
      name: 'Verniz Gel',
      price_cents: 3000,
      duration_minutes: 60,
      is_active: true,
    });

    const { data: client } = await admin
      .from('clients')
      .insert({ tenant_id: tenantId, name: 'Existing Client', phone_e164: '+351911111111' })
      .select('id')
      .single();
    existingClientId = client!.id;
  });

  afterAll(async () => {
    await admin.from('appointments').delete().eq('tenant_id', tenantId);
    await admin.from('clients').delete().eq('tenant_id', tenantId);
    await admin.from('tenants').update({ status: 'deleted' }).eq('id', tenantId);
    await admin.auth.admin.deleteUser(ownerId);
  });

  it('is not callable by anon', async () => {
    const anon = createClient(url!, publishableKey!);
    const { error } = await anon.rpc('create_manual_booking', {
      p_client_id: existingClientId,
      p_client_name: null,
      p_client_phone_e164: null,
      p_client_email: null,
      p_selected_service_ids: [serviceId],
      p_selected_package_id: null,
      p_start_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
      p_client_observation: null,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it('books an existing client without creating a duplicate client row', async () => {
    const startAt = new Date(Date.now() + 24 * 60 * 60_000);
    const { data: appointmentId, error } = await owner.rpc('create_manual_booking', {
      p_client_id: existingClientId,
      p_client_name: null,
      p_client_phone_e164: null,
      p_client_email: null,
      p_selected_service_ids: [serviceId],
      p_selected_package_id: null,
      p_start_at: startAt.toISOString(),
      p_client_observation: 'Prefere verniz vermelho.',
    });
    expect(error).toBeNull();
    expect(appointmentId).toBeTruthy();

    const appointment = await admin
      .from('appointments')
      .select('client_id, source, expected_total_cents, client_observation')
      .eq('id', appointmentId as string)
      .single();
    expect(appointment.data).toMatchObject({
      client_id: existingClientId,
      source: 'admin',
      expected_total_cents: 3000,
      client_observation: 'Prefere verniz vermelho.',
    });

    const clientsCount = await admin
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);
    expect(clientsCount.count).toBe(1);
  });

  it('creates a new client when no client_id is given', async () => {
    const startAt = new Date(Date.now() + 30 * 60 * 60_000);
    const { data: appointmentId, error } = await owner.rpc('create_manual_booking', {
      p_client_id: null,
      p_client_name: 'Brand New Client',
      p_client_phone_e164: '+351922222222',
      p_client_email: null,
      p_selected_service_ids: [serviceId],
      p_selected_package_id: null,
      p_start_at: startAt.toISOString(),
      p_client_observation: null,
    });
    expect(error).toBeNull();

    const appointment = await admin
      .from('appointments')
      .select('client_id')
      .eq('id', appointmentId as string)
      .single();
    const client = await admin
      .from('clients')
      .select('name, phone_e164')
      .eq('id', appointment.data!.client_id)
      .single();
    expect(client.data).toMatchObject({
      name: 'Brand New Client',
      phone_e164: '+351922222222',
    });
  });

  it('rejects booking onto a slot already occupied by another active appointment (conflict)', async () => {
    const takenStart = new Date(Date.now() + 50 * 60 * 60_000);
    const first = await owner.rpc('create_manual_booking', {
      p_client_id: existingClientId,
      p_client_name: null,
      p_client_phone_e164: null,
      p_client_email: null,
      p_selected_service_ids: [serviceId],
      p_selected_package_id: null,
      p_start_at: takenStart.toISOString(),
      p_client_observation: null,
    });
    expect(first.error).toBeNull();

    const second = await owner.rpc('create_manual_booking', {
      p_client_id: existingClientId,
      p_client_name: null,
      p_client_phone_e164: null,
      p_client_email: null,
      p_selected_service_ids: [serviceId],
      p_selected_package_id: null,
      p_start_at: takenStart.toISOString(),
      p_client_observation: null,
    });
    expect(second.error).not.toBeNull();
    expect(second.error?.code).toBe('23P01');
  });

  it('rejects a client_id that belongs to a different tenant', async () => {
    const otherTenantId = randomUUID();
    await admin
      .from('tenants')
      .insert({ id: otherTenantId, slug: `${slug}-other`, name: 'Other Tenant', status: 'active' });
    const { data: otherClient } = await admin
      .from('clients')
      .insert({
        tenant_id: otherTenantId,
        name: 'Other Tenant Client',
        phone_e164: '+351933333333',
      })
      .select('id')
      .single();

    const { error } = await owner.rpc('create_manual_booking', {
      p_client_id: otherClient!.id,
      p_client_name: null,
      p_client_phone_e164: null,
      p_client_email: null,
      p_selected_service_ids: [serviceId],
      p_selected_package_id: null,
      p_start_at: new Date(Date.now() + 90 * 60 * 60_000).toISOString(),
      p_client_observation: null,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('22023');

    await admin.from('clients').delete().eq('tenant_id', otherTenantId);
    await admin.from('tenants').update({ status: 'deleted' }).eq('id', otherTenantId);
  });
});
