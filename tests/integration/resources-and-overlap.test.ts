import { createHash, randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';

// NEX-215/ADR-012: exercises supabase/migrations/0043_resources_and_multi_resource_conflicts.sql
// — resources/resource_services schema, and (the important part) the 3-way split of
// appointments_no_overlap into per-provider, per-resource and tenant-wide exclusions.
// Same real-Postgres limitation as the rest of this batch: skips cleanly when unset,
// real execution happens in CI's `integration` job.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

function bookingTokenHash(seed: string) {
  return createHash('sha256').update(seed).digest('hex');
}

describe.runIf(canRun)('resources and multi-resource overlap (NEX-215)', () => {
  const admin: SupabaseClient = canRun ? createClient(url!, serviceRoleKey!) : (null as never);
  const createdUserIds: string[] = [];
  const createdSlugs: string[] = [];

  async function provisionTenant(prefix: string) {
    const email = `${prefix}-${randomUUID()}@example.test`;
    const { data: userData, error: userError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (userError) throw userError;
    createdUserIds.push(userData.user.id);

    const slug = `${prefix}-${userData.user.id.slice(0, 8)}`;
    createdSlugs.push(slug);
    const { data: tenantId, error: rpcError } = await admin.rpc('provision_tenant_owner', {
      p_user_id: userData.user.id,
      p_slug: slug,
      p_business_name: 'NEX-215 Test Salon',
      p_owner_display_name: 'Owner',
    });
    if (rpcError) throw rpcError;

    const { data: client } = await admin
      .from('clients')
      .insert({ tenant_id: tenantId, name: 'Cliente Teste', phone_e164: '+351910000097' })
      .select('id')
      .single();

    return {
      tenantId: tenantId as string,
      ownerId: userData.user.id as string,
      clientId: client!.id as string,
    };
  }

  async function makeProvider(tenantId: string, prefix: string) {
    const email = `${prefix}-${randomUUID()}@example.test`;
    const { data: userData, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (error) throw error;
    createdUserIds.push(userData.user.id);
    await admin.from('profiles').insert({
      user_id: userData.user.id,
      tenant_id: tenantId,
      role: 'provider',
      display_name: prefix,
    });
    const { data: provider, error: providerError } = await admin
      .from('service_providers')
      .insert({ tenant_id: tenantId, member_user_id: userData.user.id })
      .select('id')
      .single();
    if (providerError) throw providerError;
    return provider!.id as string;
  }

  async function insertAppointment(
    tenantId: string,
    clientId: string,
    overrides: Partial<{
      startAt: string;
      endAt: string;
      providerId: string | null;
      resourceId: string | null;
    }> = {},
  ) {
    const id = randomUUID();
    const startAt = overrides.startAt ?? '2026-06-01T10:00:00Z';
    const endAt = overrides.endAt ?? '2026-06-01T11:00:00Z';
    return admin.from('appointments').insert({
      id,
      tenant_id: tenantId,
      client_id: clientId,
      source: 'admin',
      status: 'confirmed',
      start_at: startAt,
      end_at: endAt,
      blocked_until: endAt,
      expected_total_cents: 2000,
      booking_token_hash: bookingTokenHash(id),
      provider_id: overrides.providerId ?? null,
      resource_id: overrides.resourceId ?? null,
    });
  }

  afterAll(async () => {
    if (createdSlugs.length > 0) {
      await admin.from('tenants').update({ status: 'deleted' }).in('slug', createdSlugs);
    }
    for (const id of createdUserIds) {
      await admin.auth.admin.deleteUser(id);
    }
  });

  it('creates a resource with type/capacity/color/location', async () => {
    const { tenantId } = await provisionTenant('nex215-resource');

    const { data, error } = await admin
      .from('resources')
      .insert({
        tenant_id: tenantId,
        name: 'Sala 1',
        type: 'room',
        capacity: 2,
        color: '#B24E79',
        location: 'Piso 1',
      })
      .select('type, capacity, is_active')
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ type: 'room', capacity: 2, is_active: true });
  });

  it('rejects a resource_services row whose resource/service belong to different tenants', async () => {
    const a = await provisionTenant('nex215-cross-a');
    const b = await provisionTenant('nex215-cross-b');
    const { data: resource } = await admin
      .from('resources')
      .insert({ tenant_id: a.tenantId, name: 'Cadeira', type: 'chair' })
      .select('id')
      .single();
    const { data: category } = await admin
      .from('service_categories')
      .insert({ tenant_id: b.tenantId, name: 'Unhas', sort_order: 0 })
      .select('id')
      .single();
    const { data: service } = await admin
      .from('services')
      .insert({
        tenant_id: b.tenantId,
        category_id: category!.id,
        name: 'Manicure',
        price_cents: 1000,
        duration_minutes: 30,
      })
      .select('id')
      .single();

    const { error } = await admin
      .from('resource_services')
      .insert({ tenant_id: a.tenantId, resource_id: resource!.id, service_id: service!.id });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23514');
  });

  it('two different providers CAN have overlapping appointments', async () => {
    const { tenantId, clientId } = await provisionTenant('nex215-two-providers');
    const providerA = await makeProvider(tenantId, 'nex215-provA');
    const providerB = await makeProvider(tenantId, 'nex215-provB');

    const first = await insertAppointment(tenantId, clientId, { providerId: providerA });
    expect(first.error).toBeNull();
    const second = await insertAppointment(tenantId, clientId, { providerId: providerB });
    expect(second.error).toBeNull();
  });

  it('the SAME provider cannot have two overlapping appointments', async () => {
    const { tenantId, clientId } = await provisionTenant('nex215-same-provider');
    const providerA = await makeProvider(tenantId, 'nex215-samep');

    const first = await insertAppointment(tenantId, clientId, { providerId: providerA });
    expect(first.error).toBeNull();
    const second = await insertAppointment(tenantId, clientId, {
      providerId: providerA,
      startAt: '2026-06-01T10:30:00Z',
      endAt: '2026-06-01T11:30:00Z',
    });
    expect(second.error).not.toBeNull();
    expect(second.error?.code).toBe('23P01');
  });

  it('the SAME resource cannot be double-booked, even across different providers', async () => {
    const { tenantId, clientId } = await provisionTenant('nex215-same-resource');
    const providerA = await makeProvider(tenantId, 'nex215-resA');
    const providerB = await makeProvider(tenantId, 'nex215-resB');
    const { data: resource } = await admin
      .from('resources')
      .insert({ tenant_id: tenantId, name: 'Sala Única', type: 'room' })
      .select('id')
      .single();

    const first = await insertAppointment(tenantId, clientId, {
      providerId: providerA,
      resourceId: resource!.id,
    });
    expect(first.error).toBeNull();
    const second = await insertAppointment(tenantId, clientId, {
      providerId: providerB,
      resourceId: resource!.id,
      startAt: '2026-06-01T10:30:00Z',
      endAt: '2026-06-01T11:30:00Z',
    });
    expect(second.error).not.toBeNull();
    expect(second.error?.code).toBe('23P01');
  });

  it("a plain appointment (no provider/resource) still can't overlap another plain one, tenant-wide — today's unchanged behavior", async () => {
    const { tenantId, clientId } = await provisionTenant('nex215-plain');

    const first = await insertAppointment(tenantId, clientId);
    expect(first.error).toBeNull();
    const second = await insertAppointment(tenantId, clientId, {
      startAt: '2026-06-01T10:30:00Z',
      endAt: '2026-06-01T11:30:00Z',
    });
    expect(second.error).not.toBeNull();
    expect(second.error?.code).toBe('23P01');
  });

  it('rejects an appointment whose provider_id belongs to a different tenant', async () => {
    const a = await provisionTenant('nex215-appt-cross-a');
    const b = await provisionTenant('nex215-appt-cross-b');
    const providerB = await makeProvider(b.tenantId, 'nex215-crossprov');

    const { error } = await insertAppointment(a.tenantId, a.clientId, { providerId: providerB });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23514');
  });
});
