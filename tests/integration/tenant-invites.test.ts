import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateInviteToken, hashInviteToken } from '@/lib/tenant-invite-token';
import type {
  acceptInvite as AcceptInvite,
  resolveInvite as ResolveInvite,
} from '@/lib/tenant-invite';

// NEX-212: exercises supabase/migrations/0040_tenant_invites.sql and
// src/lib/tenant-invite.ts through the same PostgREST boundary the app uses. Requires
// the same env vars as tenant-members-roles.test.ts (NEX-210); skips cleanly when
// unset — real execution happens in CI's `integration` job (see that test file's own
// comment for why this can't be applied to the shared dev project from this session).
//
// resolveInvite/acceptInvite are imported *dynamically* inside beforeAll, not
// statically at the top of the file — src/lib/tenant-invite.ts pulls in
// src/lib/supabase/admin.ts, which parses the app's full env schema
// (src/lib/env.ts) eagerly at import time. A static import would throw at module-load
// time whenever those vars are unset (e.g. CI's `verify` job, which runs this same
// `npm test` step without any Supabase env vars at all) — before describe.runIf even
// gets a chance to skip anything. Same technique tests/unit/require-profile.test.ts
// already uses for the same reason.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

describe.runIf(canRun)('tenant invites (NEX-212)', () => {
  const admin: SupabaseClient = canRun ? createClient(url!, serviceRoleKey!) : (null as never);
  const createdUserIds: string[] = [];
  const createdSlugs: string[] = [];
  let resolveInvite: typeof ResolveInvite;
  let acceptInvite: typeof AcceptInvite;

  beforeAll(async () => {
    ({ resolveInvite, acceptInvite } = await import('@/lib/tenant-invite'));
  });

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
      p_business_name: 'NEX-212 Test Salon',
      p_owner_display_name: 'Owner',
    });
    if (rpcError) throw rpcError;
    return { userId: userData.user.id as string, tenantId: tenantId as string };
  }

  async function insertInvite(
    tenantId: string,
    ownerId: string,
    overrides: Partial<{ expiresInHours: number; role: string; isProvider: boolean }> = {},
  ) {
    const token = generateInviteToken();
    const { error } = await admin.from('tenant_invites').insert({
      tenant_id: tenantId,
      token_hash: hashInviteToken(token),
      name: 'Nova Colaboradora',
      email: `invitee-${randomUUID()}@example.test`,
      role: overrides.role ?? 'receptionist',
      is_provider: overrides.isProvider ?? false,
      created_by: ownerId,
      expires_at: new Date(
        Date.now() + (overrides.expiresInHours ?? 72) * 60 * 60_000,
      ).toISOString(),
    });
    if (error) throw error;
    return token;
  }

  async function createBareUser(prefix: string) {
    const email = `${prefix}-${randomUUID()}@example.test`;
    const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (error) throw error;
    createdUserIds.push(data.user.id);
    return data.user.id as string;
  }

  afterAll(async () => {
    if (createdSlugs.length > 0) {
      await admin.from('tenants').update({ status: 'deleted' }).in('slug', createdSlugs);
    }
    for (const id of createdUserIds) {
      await admin.auth.admin.deleteUser(id);
    }
  });

  it('stores only the token hash, never the plain token', async () => {
    const { tenantId, userId } = await provisionOwner('nex212-hash');
    const token = await insertInvite(tenantId, userId);

    const { data } = await admin
      .from('tenant_invites')
      .select('token_hash')
      .eq('tenant_id', tenantId)
      .single();
    expect(data?.token_hash).toBe(hashInviteToken(token));
    expect(data?.token_hash).not.toBe(token);
  });

  it('resolveInvite returns the invite for a valid, unexpired, unused token', async () => {
    const { tenantId, userId } = await provisionOwner('nex212-resolve');
    const token = await insertInvite(tenantId, userId, { role: 'manager' });

    const resolved = await resolveInvite(token);
    expect(resolved).toMatchObject({ tenantId, role: 'manager', name: 'Nova Colaboradora' });
  });

  it('resolveInvite returns null for a token that never existed (no enumeration signal)', async () => {
    const bogusToken = generateInviteToken();
    expect(await resolveInvite(bogusToken)).toBeNull();
  });

  it('resolveInvite returns null for an expired invite', async () => {
    const { tenantId, userId } = await provisionOwner('nex212-expired');
    const token = await insertInvite(tenantId, userId, { expiresInHours: -1 });

    expect(await resolveInvite(token)).toBeNull();
  });

  it('acceptInvite creates the membership, and is single-use', async () => {
    const { tenantId, userId: ownerId } = await provisionOwner('nex212-accept');
    const token = await insertInvite(tenantId, ownerId, { role: 'receptionist' });
    const newUserId = await createBareUser('nex212-newmember');

    const first = await acceptInvite(token, newUserId);
    expect(first).toEqual({ ok: true });

    const { data: profile } = await admin
      .from('profiles')
      .select('tenant_id, role, is_active')
      .eq('user_id', newUserId)
      .single();
    expect(profile).toMatchObject({ tenant_id: tenantId, role: 'receptionist', is_active: true });

    // Single-use: the same token must not work again, even against a second new user.
    const anotherUserId = await createBareUser('nex212-second-attempt');
    const second = await acceptInvite(token, anotherUserId);
    expect(second).toEqual({ ok: false, reason: 'already_used' });

    const { data: secondProfile } = await admin
      .from('profiles')
      .select('user_id')
      .eq('user_id', anotherUserId);
    expect(secondProfile).toHaveLength(0);
  });

  it('acceptInvite also creates a service_providers row when the invite marks isProvider', async () => {
    const { tenantId, userId: ownerId } = await provisionOwner('nex212-provider-invite');
    const token = await insertInvite(tenantId, ownerId, { role: 'provider', isProvider: true });
    const newUserId = await createBareUser('nex212-newprovider');

    const result = await acceptInvite(token, newUserId);
    expect(result).toEqual({ ok: true });

    const { data: providerRow } = await admin
      .from('service_providers')
      .select('member_user_id')
      .eq('member_user_id', newUserId)
      .single();
    expect(providerRow?.member_user_id).toBe(newUserId);
  });

  it('rejects a role of admin at the database level (legacy, never assignable)', async () => {
    const { tenantId, userId } = await provisionOwner('nex212-admin-role');
    const { error } = await admin.from('tenant_invites').insert({
      tenant_id: tenantId,
      token_hash: hashInviteToken(generateInviteToken()),
      name: 'x',
      email: `x-${randomUUID()}@example.test`,
      role: 'admin',
      created_by: userId,
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23514');
  });
});
