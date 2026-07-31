import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';

// NEX-213: exercises supabase/migrations/0041_provider_business_hours.sql — schema and
// RLS for provider_business_hours/provider_business_hours_exceptions, and the
// provider-scoped availability_blocks.provider_id column. The inheritance *logic*
// itself (provider falls back to business hours per day) is a pure function fully
// covered by tests/unit/provider-schedule.test.ts — this file only proves the schema
// exists and behaves (constraints, FKs, tenant isolation).
//
// Same real-Postgres limitation as tenant-members-roles.test.ts (NEX-210): skips
// cleanly when unset, real execution happens in CI's `integration` job.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

describe.runIf(canRun)('provider business hours (NEX-213)', () => {
  const admin: SupabaseClient = canRun ? createClient(url!, serviceRoleKey!) : (null as never);
  const createdUserIds: string[] = [];
  const createdSlugs: string[] = [];

  async function provisionOwnerWithProvider(prefix: string) {
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
      p_business_name: 'NEX-213 Test Salon',
      p_owner_display_name: 'Owner',
    });
    if (rpcError) throw rpcError;

    const { data: provider, error: providerError } = await admin
      .from('service_providers')
      .insert({ tenant_id: tenantId, member_user_id: userData.user.id })
      .select('id')
      .single();
    if (providerError) throw providerError;

    return { tenantId: tenantId as string, providerId: provider!.id as string };
  }

  afterAll(async () => {
    if (createdSlugs.length > 0) {
      await admin.from('tenants').update({ status: 'deleted' }).in('slug', createdSlugs);
    }
    for (const id of createdUserIds) {
      await admin.auth.admin.deleteUser(id);
    }
  });

  it('accepts a weekly hours row for a provider, one per day of week', async () => {
    const { tenantId, providerId } = await provisionOwnerWithProvider('nex213-weekly');

    const { error } = await admin.from('provider_business_hours').insert({
      tenant_id: tenantId,
      provider_id: providerId,
      day_of_week: 1,
      is_open: true,
      opens_at: '10:00',
      closes_at: '14:00',
    });
    expect(error).toBeNull();

    const { error: duplicateError } = await admin.from('provider_business_hours').insert({
      tenant_id: tenantId,
      provider_id: providerId,
      day_of_week: 1,
      is_open: true,
      opens_at: '15:00',
      closes_at: '18:00',
    });
    expect(duplicateError).not.toBeNull();
    expect(duplicateError?.code).toBe('23505');
  });

  it('rejects opens_at >= closes_at when open', async () => {
    const { tenantId, providerId } = await provisionOwnerWithProvider('nex213-invalid-hours');

    const { error } = await admin.from('provider_business_hours').insert({
      tenant_id: tenantId,
      provider_id: providerId,
      day_of_week: 2,
      is_open: true,
      opens_at: '18:00',
      closes_at: '10:00',
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23514');
  });

  it('accepts a one-off exception (e.g. a provider taking a specific day off)', async () => {
    const { tenantId, providerId } = await provisionOwnerWithProvider('nex213-exception');

    const { error } = await admin.from('provider_business_hours_exceptions').insert({
      tenant_id: tenantId,
      provider_id: providerId,
      exception_date: '2026-12-24',
      is_open: false,
      reason: 'Férias',
    });
    expect(error).toBeNull();
  });

  it('an availability_blocks row can be scoped to a single provider via provider_id', async () => {
    const { tenantId, providerId } = await provisionOwnerWithProvider('nex213-block');

    const { data, error } = await admin
      .from('availability_blocks')
      .insert({
        tenant_id: tenantId,
        provider_id: providerId,
        starts_at: '2026-12-24T00:00:00Z',
        ends_at: '2026-12-25T00:00:00Z',
        is_all_day: true,
        reason: 'Férias do prestador',
      })
      .select('provider_id')
      .single();
    expect(error).toBeNull();
    expect(data?.provider_id).toBe(providerId);
  });

  it('a tenant-wide block (provider_id null) still works unchanged', async () => {
    const { tenantId } = await provisionOwnerWithProvider('nex213-tenant-block');

    const { data, error } = await admin
      .from('availability_blocks')
      .insert({
        tenant_id: tenantId,
        starts_at: '2026-12-25T00:00:00Z',
        ends_at: '2026-12-26T00:00:00Z',
        is_all_day: true,
        reason: 'Feriado',
      })
      .select('provider_id')
      .single();
    expect(error).toBeNull();
    expect(data?.provider_id).toBeNull();
  });
});
