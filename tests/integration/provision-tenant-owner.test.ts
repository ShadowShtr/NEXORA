import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';

// Exercises the provision_tenant_owner RPC from
// supabase/migrations/0003_provision_tenant_owner.sql through the same PostgREST
// boundary scripts/provision-owner.mjs uses. Requires the same env vars the app and
// that script use; skips cleanly when unset.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

describe.runIf(canRun)('provision_tenant_owner (NEX-013)', () => {
  const admin: SupabaseClient = canRun ? createClient(url!, serviceRoleKey!) : (null as never);
  const anon: SupabaseClient = canRun ? createClient(url!, publishableKey!) : (null as never);
  const createdUserIds: string[] = [];
  const createdSlugs: string[] = [];

  async function createBareUser() {
    const email = `nex013-${randomUUID()}@example.test`;
    const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (error) throw error;
    createdUserIds.push(data.user.id);
    return data.user.id;
  }

  afterAll(async () => {
    if (createdSlugs.length > 0) {
      await admin.from('tenants').delete().in('slug', createdSlugs);
    }
    for (const id of createdUserIds) {
      await admin.auth.admin.deleteUser(id);
    }
  });

  it('atomically creates tenant, profile, business_settings and an audit log entry', async () => {
    const userId = await createBareUser();
    const slug = `nex013-${userId.slice(0, 8)}`;
    createdSlugs.push(slug);

    const { data: tenantId, error } = await admin.rpc('provision_tenant_owner', {
      p_user_id: userId,
      p_slug: slug,
      p_business_name: 'Provision Test Salon',
      p_owner_display_name: 'Owner Name',
    });
    expect(error).toBeNull();
    expect(tenantId).toBeTruthy();

    const tenant = await admin.from('tenants').select('status').eq('id', tenantId).single();
    expect(tenant.data?.status).toBe('setup');

    const profile = await admin
      .from('profiles')
      .select('role, display_name')
      .eq('user_id', userId)
      .single();
    expect(profile.data).toMatchObject({ role: 'owner', display_name: 'Owner Name' });

    const settings = await admin
      .from('business_settings')
      .select('professional_name')
      .eq('tenant_id', tenantId)
      .single();
    expect(settings.data?.professional_name).toBe('Owner Name');

    const audit = await admin
      .from('audit_logs')
      .select('action, resource_type, actor_user_id')
      .eq('tenant_id', tenantId)
      .single();
    expect(audit.data).toMatchObject({
      action: 'tenant.provisioned',
      resource_type: 'tenant',
      actor_user_id: userId,
    });
  });

  it('rolls back everything when a downstream insert fails', async () => {
    const userId = await createBareUser();
    const slug = `nex013-rollback-${userId.slice(0, 8)}`;
    createdSlugs.push(slug);

    const { error } = await admin.rpc('provision_tenant_owner', {
      p_user_id: userId,
      p_slug: slug,
      p_business_name: 'Should Roll Back',
      p_owner_display_name: null,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23502');

    const tenant = await admin.from('tenants').select('id').eq('slug', slug);
    expect(tenant.data).toHaveLength(0);
  });

  it('rejects provisioning the same user twice', async () => {
    const userId = await createBareUser();
    const slugA = `nex013-dup-a-${userId.slice(0, 8)}`;
    const slugB = `nex013-dup-b-${userId.slice(0, 8)}`;
    createdSlugs.push(slugA, slugB);

    const first = await admin.rpc('provision_tenant_owner', {
      p_user_id: userId,
      p_slug: slugA,
      p_business_name: 'First Tenant',
      p_owner_display_name: 'Owner',
    });
    expect(first.error).toBeNull();

    const second = await admin.rpc('provision_tenant_owner', {
      p_user_id: userId,
      p_slug: slugB,
      p_business_name: 'Second Tenant',
      p_owner_display_name: 'Owner',
    });
    expect(second.error).not.toBeNull();
    expect(second.error?.code).toBe('23505');

    const secondTenant = await admin.from('tenants').select('id').eq('slug', slugB);
    expect(secondTenant.data).toHaveLength(0);
  });

  it('is not callable by anon', async () => {
    const { error } = await anon.rpc('provision_tenant_owner', {
      p_user_id: randomUUID(),
      p_slug: 'should-not-work',
      p_business_name: 'x',
      p_owner_display_name: 'x',
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });
});
