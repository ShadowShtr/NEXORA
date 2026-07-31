import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';

// NEX-214: exercises supabase/migrations/0042_provider_services.sql — the N:N
// provider<->service relation, its uniqueness/same-tenant guarantees. The price/
// duration fallback *logic* is a pure function fully covered by
// tests/unit/provider-service.test.ts — this file only proves the schema itself.
// Same real-Postgres limitation as the other NEX-21x integration tests in this batch:
// skips cleanly when unset, real execution happens in CI's `integration` job.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

describe.runIf(canRun)('provider services (NEX-214)', () => {
  const admin: SupabaseClient = canRun ? createClient(url!, serviceRoleKey!) : (null as never);
  const createdUserIds: string[] = [];
  const createdSlugs: string[] = [];

  async function provisionTenantWithProviderAndService(prefix: string) {
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
      p_business_name: 'NEX-214 Test Salon',
      p_owner_display_name: 'Owner',
    });
    if (rpcError) throw rpcError;

    const { data: provider, error: providerError } = await admin
      .from('service_providers')
      .insert({ tenant_id: tenantId, member_user_id: userData.user.id })
      .select('id')
      .single();
    if (providerError) throw providerError;

    const { data: category } = await admin
      .from('service_categories')
      .insert({ tenant_id: tenantId, name: 'Unhas', sort_order: 0 })
      .select('id')
      .single();
    const { data: service, error: serviceError } = await admin
      .from('services')
      .insert({
        tenant_id: tenantId,
        category_id: category!.id,
        name: 'Manicure Simples',
        price_cents: 1200,
        duration_minutes: 30,
        is_active: true,
      })
      .select('id')
      .single();
    if (serviceError) throw serviceError;

    return {
      tenantId: tenantId as string,
      providerId: provider!.id as string,
      serviceId: service!.id as string,
    };
  }

  afterAll(async () => {
    if (createdSlugs.length > 0) {
      await admin.from('tenants').update({ status: 'deleted' }).in('slug', createdSlugs);
    }
    for (const id of createdUserIds) {
      await admin.auth.admin.deleteUser(id);
    }
  });

  it('links a provider to a service with no override (defaults: active, priority 0)', async () => {
    const { tenantId, providerId, serviceId } =
      await provisionTenantWithProviderAndService('nex214-basic');

    const { data, error } = await admin
      .from('provider_services')
      .insert({ tenant_id: tenantId, provider_id: providerId, service_id: serviceId })
      .select('price_cents, duration_minutes, is_active, priority')
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({
      price_cents: null,
      duration_minutes: null,
      is_active: true,
      priority: 0,
    });
  });

  it('accepts a price/duration override ("Personalizar para esta pessoa")', async () => {
    const { tenantId, providerId, serviceId } =
      await provisionTenantWithProviderAndService('nex214-override');

    const { data, error } = await admin
      .from('provider_services')
      .insert({
        tenant_id: tenantId,
        provider_id: providerId,
        service_id: serviceId,
        price_cents: 2500,
        duration_minutes: 60,
        priority: 5,
      })
      .select('price_cents, duration_minutes, priority')
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ price_cents: 2500, duration_minutes: 60, priority: 5 });
  });

  it('rejects a duplicate provider/service pair', async () => {
    const { tenantId, providerId, serviceId } =
      await provisionTenantWithProviderAndService('nex214-duplicate');
    await admin
      .from('provider_services')
      .insert({ tenant_id: tenantId, provider_id: providerId, service_id: serviceId });

    const { error } = await admin
      .from('provider_services')
      .insert({ tenant_id: tenantId, provider_id: providerId, service_id: serviceId });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23505');
  });

  it('rejects a provider from a different tenant than the service', async () => {
    const tenantA = await provisionTenantWithProviderAndService('nex214-cross-a');
    const tenantB = await provisionTenantWithProviderAndService('nex214-cross-b');

    const { error } = await admin.from('provider_services').insert({
      tenant_id: tenantA.tenantId,
      provider_id: tenantB.providerId,
      service_id: tenantA.serviceId,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23514');
  });

  it('rejects a negative price override', async () => {
    const { tenantId, providerId, serviceId } =
      await provisionTenantWithProviderAndService('nex214-negative-price');

    const { error } = await admin.from('provider_services').insert({
      tenant_id: tenantId,
      provider_id: providerId,
      service_id: serviceId,
      price_cents: -100,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23514');
  });
});
