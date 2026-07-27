import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// NEX-166 (security review): get_public_business_hours (0030_business_public_profile.sql)
// is security definer, granted directly to anon/authenticated, and — before
// 0038_public_business_hours_tenant_check.sql — trusted p_tenant_id without checking
// the tenant was actually published. Anyone who already had/guessed a tenant_id could
// read the weekly hours of a suspended/unpublished tenant by calling the RPC directly
// (bypassing the /b/[slug] page-level checks the original comment assumed were the
// only way in). This is the regression test for that fix.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

describe.runIf(canRun)('get_public_business_hours tenant status check (NEX-166)', () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;

  const publishedTenantId = randomUUID();
  const unpublishedTenantId = randomUUID();

  beforeAll(async () => {
    admin = createClient(url!, serviceRoleKey!);
    anon = createClient(url!, publishableKey!);

    const { error: tenantsError } = await admin.from('tenants').insert([
      {
        id: publishedTenantId,
        slug: `nex166-hours-pub-${publishedTenantId.slice(0, 8)}`,
        name: 'Published Tenant',
        status: 'active',
      },
      {
        id: unpublishedTenantId,
        slug: `nex166-hours-unpub-${unpublishedTenantId.slice(0, 8)}`,
        name: 'Unpublished Tenant',
        status: 'setup',
      },
    ]);
    if (tenantsError) throw tenantsError;

    const { error: settingsError } = await admin.from('business_settings').insert([
      { tenant_id: publishedTenantId, buffer_minutes: 15, published_at: new Date().toISOString() },
      { tenant_id: unpublishedTenantId, buffer_minutes: 15, published_at: null },
    ]);
    if (settingsError) throw settingsError;

    const { error: hoursError } = await admin.from('business_hours').insert([
      {
        tenant_id: publishedTenantId,
        day_of_week: 1,
        is_open: true,
        opens_at: '09:00',
        closes_at: '18:00',
      },
      {
        tenant_id: unpublishedTenantId,
        day_of_week: 1,
        is_open: true,
        opens_at: '09:00',
        closes_at: '18:00',
      },
    ]);
    if (hoursError) throw hoursError;
  });

  afterAll(async () => {
    await admin.from('tenants').delete().in('id', [publishedTenantId, unpublishedTenantId]);
  });

  it('returns hours for a published, active tenant', async () => {
    const { data, error } = await anon.rpc('get_public_business_hours', {
      p_tenant_id: publishedTenantId,
    });
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('returns nothing for an unpublished tenant, even though the row exists', async () => {
    const { data, error } = await anon.rpc('get_public_business_hours', {
      p_tenant_id: unpublishedTenantId,
    });
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('returns nothing for an unknown tenant_id', async () => {
    const { data, error } = await anon.rpc('get_public_business_hours', {
      p_tenant_id: randomUUID(),
    });
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
