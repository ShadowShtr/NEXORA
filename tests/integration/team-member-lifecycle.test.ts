import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';

// NEX-219: covers the parts of "desativação de membro" and "isolamento tenant" that
// NEX-210 through NEX-215's own test files don't already exercise —
// assert_not_last_owner (0039_tenant_members_and_providers.sql), the DB-level effect of
// deactivating a member (requireProfile()'s own session-rejection is already unit-tested
// in tests/unit/require-profile.test.ts), and that a tenant-scoped update genuinely
// touches zero rows for another tenant's data (the same invariant
// src/lib/write-confirmation.ts's hasAffectedRows exists to surface, exercised here at
// the database layer it ultimately depends on). Same real-Postgres limitation as the
// rest of this batch: skips cleanly when unset, real execution happens in CI's
// `integration` job.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

describe.runIf(canRun)('team member lifecycle (NEX-219)', () => {
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
      p_business_name: 'NEX-219 Test Salon',
      p_owner_display_name: 'Owner',
    });
    if (rpcError) throw rpcError;
    return { tenantId: tenantId as string, ownerId: userData.user.id as string };
  }

  async function addMember(tenantId: string, prefix: string, role: string) {
    const email = `${prefix}-${randomUUID()}@example.test`;
    const { data: userData, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (error) throw error;
    createdUserIds.push(userData.user.id);
    const { error: profileError } = await admin
      .from('profiles')
      .insert({ user_id: userData.user.id, tenant_id: tenantId, role, display_name: prefix });
    if (profileError) throw profileError;
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

  it('assert_not_last_owner rejects demoting the sole active owner', async () => {
    const { tenantId, ownerId } = await provisionTenant('nex219-sole-owner');

    const { error } = await admin.rpc('assert_not_last_owner', {
      p_tenant_id: tenantId,
      p_user_id: ownerId,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23514');
  });

  it('assert_not_last_owner allows the change when a second active owner exists', async () => {
    const { tenantId, ownerId } = await provisionTenant('nex219-two-owners-a');
    await addMember(tenantId, 'nex219-second-owner', 'owner');

    const { error } = await admin.rpc('assert_not_last_owner', {
      p_tenant_id: tenantId,
      p_user_id: ownerId,
    });
    expect(error).toBeNull();
  });

  it('assert_not_last_owner is a no-op for a non-owner member', async () => {
    const { tenantId } = await provisionTenant('nex219-non-owner');
    const receptionistId = await addMember(tenantId, 'nex219-receptionist', 'receptionist');

    const { error } = await admin.rpc('assert_not_last_owner', {
      p_tenant_id: tenantId,
      p_user_id: receptionistId,
    });
    expect(error).toBeNull();
  });

  it('deactivating a member sets is_active=false without deleting the profile', async () => {
    const { tenantId } = await provisionTenant('nex219-deactivate');
    const memberId = await addMember(tenantId, 'nex219-member', 'receptionist');

    const { data, error } = await admin
      .from('profiles')
      .update({ is_active: false })
      .eq('user_id', memberId)
      .eq('tenant_id', tenantId)
      .select('user_id, is_active');
    expect(error).toBeNull();
    expect(data).toEqual([{ user_id: memberId, is_active: false }]);
  });

  it('a tenant-scoped update touches zero rows for a member of a different tenant (ADR-010 invariant)', async () => {
    const a = await provisionTenant('nex219-isolation-a');
    const b = await provisionTenant('nex219-isolation-b');

    // Attempting to update tenant B's owner while filtering by tenant A's id — the
    // same shape as a Server Action deriving tenantId from its own caller's session
    // (member-actions.ts) — must affect zero rows, never tenant B's real row.
    const { data, error } = await admin
      .from('profiles')
      .update({ role: 'manager' })
      .eq('user_id', b.ownerId)
      .eq('tenant_id', a.tenantId)
      .select('user_id');
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { data: unchanged } = await admin
      .from('profiles')
      .select('role')
      .eq('user_id', b.ownerId)
      .single();
    expect(unchanged?.role).toBe('owner');
  });
});
