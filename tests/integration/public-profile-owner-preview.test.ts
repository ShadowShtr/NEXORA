import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// NEX-142: "Pré-visualização da página pública — mudanças visuais sem publicar
// acidentalmente." /b/[slug]'s hours section (loadPublicProfile, src/app/b/[slug]/
// page.tsx) reads business_hours directly for the tenant's own owner instead of the
// public get_public_business_hours RPC — that RPC hardcodes a published-only check
// (NEX-166/0038) for every caller, so it can't tell the owner apart from a stranger.
// This is the regression test for the direct-table-read path that makes the preview
// actually work pre-publish, and for the tenant isolation it must not weaken.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

describe.runIf(canRun)('public profile owner preview (NEX-142)', () => {
  let admin: SupabaseClient;
  let owner: SupabaseClient;
  let otherOwner: SupabaseClient;

  const tenantId = randomUUID();
  const otherTenantId = randomUUID();
  const slug = `nex142-${tenantId.slice(0, 8)}`;
  const otherSlug = `nex142-other-${otherTenantId.slice(0, 8)}`;
  const ownerEmail = `nex142-owner-${randomUUID()}@example.test`;
  const otherOwnerEmail = `nex142-other-owner-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}!`;
  let ownerUserId: string;
  let otherOwnerUserId: string;

  beforeAll(async () => {
    admin = createClient(url!, serviceRoleKey!);
    owner = createClient(url!, publishableKey!);
    otherOwner = createClient(url!, publishableKey!);

    // Tenant under test: never published — exactly the "still setting up, want to
    // preview" scenario this task exists for.
    await admin
      .from('tenants')
      .insert({ id: tenantId, slug, name: 'Unpublished Tenant', status: 'setup' });
    await admin
      .from('business_settings')
      .insert({ tenant_id: tenantId, buffer_minutes: 15, published_at: null });
    await admin.from('business_hours').insert({
      tenant_id: tenantId,
      day_of_week: 1,
      is_open: true,
      opens_at: '09:00',
      closes_at: '18:00',
    });

    // A second, unrelated tenant/owner — must never see the first tenant's hours.
    await admin
      .from('tenants')
      .insert({ id: otherTenantId, slug: otherSlug, name: 'Other Tenant', status: 'active' });
    await admin.from('business_settings').insert({
      tenant_id: otherTenantId,
      buffer_minutes: 15,
      published_at: new Date().toISOString(),
    });

    const ownerCreated = await admin.auth.admin.createUser({
      email: ownerEmail,
      password,
      email_confirm: true,
    });
    if (ownerCreated.error) throw ownerCreated.error;
    ownerUserId = ownerCreated.data.user.id;
    await admin
      .from('profiles')
      .insert({ user_id: ownerUserId, tenant_id: tenantId, role: 'owner', display_name: 'Owner' });

    const otherOwnerCreated = await admin.auth.admin.createUser({
      email: otherOwnerEmail,
      password,
      email_confirm: true,
    });
    if (otherOwnerCreated.error) throw otherOwnerCreated.error;
    otherOwnerUserId = otherOwnerCreated.data.user.id;
    await admin.from('profiles').insert({
      user_id: otherOwnerUserId,
      tenant_id: otherTenantId,
      role: 'owner',
      display_name: 'Other Owner',
    });

    const ownerSignIn = await owner.auth.signInWithPassword({ email: ownerEmail, password });
    if (ownerSignIn.error) throw ownerSignIn.error;
    const otherSignIn = await otherOwner.auth.signInWithPassword({
      email: otherOwnerEmail,
      password,
    });
    if (otherSignIn.error) throw otherSignIn.error;
  });

  afterAll(async () => {
    await admin.from('tenants').update({ status: 'deleted' }).in('id', [tenantId, otherTenantId]);
    await admin.auth.admin.deleteUser(ownerUserId);
    await admin.auth.admin.deleteUser(otherOwnerUserId);
  });

  it("lets the tenant's own owner read business_hours directly even though the tenant is unpublished", async () => {
    const { data, error } = await owner
      .from('business_hours')
      .select('day_of_week, is_open, opens_at, closes_at')
      .eq('tenant_id', tenantId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({ day_of_week: 1, is_open: true, opens_at: '09:00:00' });
  });

  it("never lets a different tenant's owner read this tenant's business_hours", async () => {
    const { data, error } = await otherOwner
      .from('business_hours')
      .select('day_of_week, is_open, opens_at, closes_at')
      .eq('tenant_id', tenantId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('still returns nothing from the public RPC for this unpublished tenant (a genuine visitor is unaffected by the owner-preview path)', async () => {
    const anon = createClient(url!, publishableKey!);
    const { data, error } = await anon.rpc('get_public_business_hours', {
      p_tenant_id: tenantId,
    });
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
