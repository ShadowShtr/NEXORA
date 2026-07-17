import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Exercises the publish_business RPC from supabase/migrations/0005_publish_business.sql
// through the same PostgREST boundary the app uses. Requires the same env vars as
// rls-tenant-isolation.test.ts; skips cleanly when unset.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

describe.runIf(canRun)('publish_business (NEX-035)', () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  let userA: SupabaseClient;
  let userB: SupabaseClient;

  const tenantAId = randomUUID();
  const tenantBId = randomUUID();
  const emailA = `nex035-a-${randomUUID()}@example.test`;
  const emailB = `nex035-b-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}!`;
  let userAId: string;
  let userBId: string;
  const slugA = `nex035-a-${tenantAId.slice(0, 8)}`;
  const slugB = `nex035-b-${tenantBId.slice(0, 8)}`;
  const publishedSlugA = `${slugA}-published`;

  beforeAll(async () => {
    admin = createClient(url!, serviceRoleKey!);
    anon = createClient(url!, publishableKey!);

    const { error: tenantsError } = await admin.from('tenants').insert([
      { id: tenantAId, slug: slugA, name: 'Tenant A', status: 'setup' },
      { id: tenantBId, slug: slugB, name: 'Tenant B', status: 'setup' },
    ]);
    if (tenantsError) throw tenantsError;

    const { error: settingsError } = await admin
      .from('business_settings')
      .insert([{ tenant_id: tenantAId }, { tenant_id: tenantBId }]);
    if (settingsError) throw settingsError;

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

    const { error: profilesError } = await admin.from('profiles').insert([
      { user_id: userAId, tenant_id: tenantAId, role: 'owner', display_name: 'Owner A' },
      { user_id: userBId, tenant_id: tenantBId, role: 'owner', display_name: 'Owner B' },
    ]);
    if (profilesError) throw profilesError;

    userA = createClient(url!, publishableKey!);
    const signInA = await userA.auth.signInWithPassword({ email: emailA, password });
    if (signInA.error) throw signInA.error;

    userB = createClient(url!, publishableKey!);
    const signInB = await userB.auth.signInWithPassword({ email: emailB, password });
    if (signInB.error) throw signInB.error;
  });

  afterAll(async () => {
    await admin.from('tenants').delete().in('id', [tenantAId, tenantBId]);
    if (userAId) await admin.auth.admin.deleteUser(userAId);
    if (userBId) await admin.auth.admin.deleteUser(userBId);
  });

  it('is not callable by anon', async () => {
    const { error } = await anon.rpc('publish_business', { p_slug: 'anon-should-not-work' });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it("publishes the caller's own tenant: new slug, active status, published_at, audit log", async () => {
    const { error } = await userA.rpc('publish_business', { p_slug: publishedSlugA });
    expect(error).toBeNull();

    const tenant = await admin.from('tenants').select('slug, status').eq('id', tenantAId).single();
    expect(tenant.data).toMatchObject({ slug: publishedSlugA, status: 'active' });

    const settings = await admin
      .from('business_settings')
      .select('published_at')
      .eq('tenant_id', tenantAId)
      .single();
    expect(settings.data?.published_at).not.toBeNull();

    const audit = await admin
      .from('audit_logs')
      .select('action, resource_type, actor_user_id, metadata')
      .eq('tenant_id', tenantAId)
      .eq('action', 'business.published')
      .single();
    expect(audit.data).toMatchObject({
      action: 'business.published',
      resource_type: 'tenant',
      actor_user_id: userAId,
      metadata: { slug: publishedSlugA },
    });

    // Tenant B, untouched by A's call, must still have its original slug/status.
    const tenantB = await admin.from('tenants').select('slug, status').eq('id', tenantBId).single();
    expect(tenantB.data).toMatchObject({ slug: slugB, status: 'setup' });
  });

  it('rejects publishing with a slug already used by another tenant (collision)', async () => {
    const { error } = await userB.rpc('publish_business', { p_slug: publishedSlugA });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23505');

    const tenantB = await admin.from('tenants').select('slug, status').eq('id', tenantBId).single();
    expect(tenantB.data).toMatchObject({ slug: slugB, status: 'setup' });
  });
});
