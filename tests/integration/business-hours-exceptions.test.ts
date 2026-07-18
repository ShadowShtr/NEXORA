import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Exercises RLS and constraints on business_hours_exceptions (0006_business_hours_exceptions.sql)
// through the same PostgREST boundary the app uses. Same env vars as rls-tenant-isolation.test.ts;
// skips cleanly when unset.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

describe.runIf(canRun)('business_hours_exceptions RLS and constraints (NEX-060)', () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  let userA: SupabaseClient;
  let userB: SupabaseClient;

  const tenantAId = randomUUID();
  const tenantBId = randomUUID();
  const emailA = `nex060-a-${randomUUID()}@example.test`;
  const emailB = `nex060-b-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}!`;
  let userAId: string;
  let userBId: string;
  const exceptionAId = randomUUID();

  beforeAll(async () => {
    admin = createClient(url!, serviceRoleKey!);
    anon = createClient(url!, publishableKey!);

    const { error: tenantsError } = await admin.from('tenants').insert([
      {
        id: tenantAId,
        slug: `nex060-a-${tenantAId.slice(0, 8)}`,
        name: 'Tenant A',
        status: 'setup',
      },
      {
        id: tenantBId,
        slug: `nex060-b-${tenantBId.slice(0, 8)}`,
        name: 'Tenant B',
        status: 'setup',
      },
    ]);
    if (tenantsError) throw tenantsError;

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

    const { error: exceptionError } = await admin.from('business_hours_exceptions').insert({
      id: exceptionAId,
      tenant_id: tenantAId,
      exception_date: '2026-12-24',
      is_open: true,
      opens_at: '09:00',
      closes_at: '13:00',
    });
    if (exceptionError) throw exceptionError;

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

  it('owner sees their own tenant exception', async () => {
    const { data, error } = await userA
      .from('business_hours_exceptions')
      .select('id')
      .eq('id', exceptionAId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('owner from another tenant cannot see it', async () => {
    const { data, error } = await userB
      .from('business_hours_exceptions')
      .select('id')
      .eq('id', exceptionAId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('anon cannot see it (no public policy — raw schedule is never exposed directly)', async () => {
    const { data, error } = await anon
      .from('business_hours_exceptions')
      .select('id')
      .eq('id', exceptionAId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('owner cannot insert an exception claiming another tenant id', async () => {
    const { error } = await userB.from('business_hours_exceptions').insert({
      tenant_id: tenantAId,
      exception_date: '2026-12-25',
      is_open: false,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it('owner cannot update another tenant exception', async () => {
    const { data, error } = await userB
      .from('business_hours_exceptions')
      .update({ is_open: false })
      .eq('id', exceptionAId)
      .select();
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('owner cannot delete another tenant exception', async () => {
    const { data, error } = await userB
      .from('business_hours_exceptions')
      .delete()
      .eq('id', exceptionAId)
      .select();
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('owner can update their own tenant exception', async () => {
    const { data, error } = await userA
      .from('business_hours_exceptions')
      .update({ closes_at: '14:00' })
      .eq('id', exceptionAId)
      .select();
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.closes_at).toBe('14:00:00');
  });

  it('a duplicate exception_date within the same tenant is rejected', async () => {
    const { error } = await userA.from('business_hours_exceptions').insert({
      tenant_id: tenantAId,
      exception_date: '2026-12-24',
      is_open: false,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23505');
  });

  it('is_open=true requires opens_at before closes_at', async () => {
    const { error } = await userA.from('business_hours_exceptions').insert({
      tenant_id: tenantAId,
      exception_date: '2026-12-26',
      is_open: true,
      opens_at: '13:00',
      closes_at: '09:00',
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23514');
  });

  it('is_open=false allows null opens_at/closes_at (closed that date)', async () => {
    const { data, error } = await userA
      .from('business_hours_exceptions')
      .insert({ tenant_id: tenantAId, exception_date: '2026-12-27', is_open: false })
      .select();
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('rejects lunch_ends_at before lunch_starts_at', async () => {
    const { error } = await userA.from('business_hours_exceptions').insert({
      tenant_id: tenantAId,
      exception_date: '2026-12-28',
      is_open: true,
      opens_at: '09:00',
      closes_at: '18:00',
      lunch_starts_at: '14:00',
      lunch_ends_at: '13:00',
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23514');
  });
});
