import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';

// NEX-210: exercises supabase/migrations/0039_tenant_members_and_providers.sql —
// profiles.role (new values)/is_active, service_providers, and the
// assert_not_last_owner RPC — through the same PostgREST boundary the app uses.
// Requires the same env vars as provision-tenant-owner.test.ts; skips cleanly when
// unset. Note: this migration only actually exists once applied — locally that means
// `supabase start` (Docker), or in CI's `integration` job, which applies every
// migration fresh against its own ephemeral Postgres on every run.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

describe.runIf(canRun)('tenant members, roles and providers (NEX-210)', () => {
  const admin: SupabaseClient = canRun ? createClient(url!, serviceRoleKey!) : (null as never);
  const createdUserIds: string[] = [];
  const createdSlugs: string[] = [];

  async function provisionOwner(prefix: string) {
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
      p_business_name: 'NEX-210 Test Salon',
      p_owner_display_name: 'Owner',
    });
    if (rpcError) throw rpcError;
    return { userId: userData.user.id as string, tenantId: tenantId as string };
  }

  async function addMember(tenantId: string, role: string) {
    const email = `nex210-member-${randomUUID()}@example.test`;
    const { data: userData, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (error) throw error;
    createdUserIds.push(userData.user.id);
    const { error: insertError } = await admin.from('profiles').insert({
      user_id: userData.user.id,
      tenant_id: tenantId,
      role,
      display_name: `Member ${role}`,
    });
    if (insertError) throw insertError;
    return userData.user.id as string;
  }

  afterAll(async () => {
    if (createdSlugs.length > 0) {
      await admin.from('tenants').update({ status: 'deleted' }).in('slug', createdSlugs);
    }
    for (const id of createdUserIds) {
      await admin.auth.admin.deleteUser(id);
    }
  });

  it.each(['owner', 'manager', 'receptionist', 'provider', 'viewer'])(
    'accepts a profile with role %s',
    async (role) => {
      const { tenantId } = await provisionOwner('nex210-role');
      const memberId = await addMember(tenantId, role);

      const { data, error } = await admin
        .from('profiles')
        .select('role, is_active')
        .eq('user_id', memberId)
        .single();
      expect(error).toBeNull();
      expect(data).toMatchObject({ role, is_active: true });
    },
  );

  it('a member can exist without being a provider', async () => {
    const { tenantId } = await provisionOwner('nex210-nonprovider');
    const receptionistId = await addMember(tenantId, 'receptionist');

    const providerRow = await admin
      .from('service_providers')
      .select('id')
      .eq('member_user_id', receptionistId);
    expect(providerRow.data).toHaveLength(0);
  });

  it('creates a service_providers row scoped to the same tenant, with defaults', async () => {
    const { tenantId } = await provisionOwner('nex210-provider');
    const providerId = await addMember(tenantId, 'provider');

    const { data, error } = await admin
      .from('service_providers')
      .insert({ tenant_id: tenantId, member_user_id: providerId })
      .select('status, booking_enabled, display_order, color')
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({
      status: 'active',
      booking_enabled: true,
      display_order: 0,
      color: null,
    });
  });

  it('rejects a service_providers row whose member belongs to a different tenant', async () => {
    const { tenantId: tenantA } = await provisionOwner('nex210-cross-a');
    const { tenantId: tenantB, userId: ownerB } = await provisionOwner('nex210-cross-b');

    const { error } = await admin
      .from('service_providers')
      .insert({ tenant_id: tenantA, member_user_id: ownerB });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23514');
    void tenantB;
  });

  it('rejects an invalid color format', async () => {
    const { tenantId } = await provisionOwner('nex210-color');
    const providerId = await addMember(tenantId, 'provider');

    const { error } = await admin
      .from('service_providers')
      .insert({ tenant_id: tenantId, member_user_id: providerId, color: 'not-a-hex-color' });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23514');
  });

  describe('assert_not_last_owner', () => {
    it("raises when the target is the tenant's only active owner", async () => {
      const { tenantId, userId } = await provisionOwner('nex210-lastowner');

      const { error } = await admin.rpc('assert_not_last_owner', {
        p_tenant_id: tenantId,
        p_user_id: userId,
      });
      expect(error).not.toBeNull();
      expect(error?.code).toBe('23514');
    });

    it('allows it when another active owner exists', async () => {
      const { tenantId, userId } = await provisionOwner('nex210-coowner');
      await addMember(tenantId, 'owner');

      const { error } = await admin.rpc('assert_not_last_owner', {
        p_tenant_id: tenantId,
        p_user_id: userId,
      });
      expect(error).toBeNull();
    });

    it('is a no-op for a non-owner role', async () => {
      const { tenantId } = await provisionOwner('nex210-nonowner');
      const managerId = await addMember(tenantId, 'manager');

      const { error } = await admin.rpc('assert_not_last_owner', {
        p_tenant_id: tenantId,
        p_user_id: managerId,
      });
      expect(error).toBeNull();
    });

    it('is a no-op for an already-inactive owner', async () => {
      const { tenantId, userId } = await provisionOwner('nex210-inactive-owner');
      await admin.from('profiles').update({ is_active: false }).eq('user_id', userId);

      const { error } = await admin.rpc('assert_not_last_owner', {
        p_tenant_id: tenantId,
        p_user_id: userId,
      });
      expect(error).toBeNull();
    });
  });
});
