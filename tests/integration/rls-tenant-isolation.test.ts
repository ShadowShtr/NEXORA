import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Exercises RLS policies from supabase/migrations/0001_initial.sql through the same
// PostgREST boundary the app uses (unlike schema-invariants.test.ts, which connects
// directly to Postgres and bypasses RLS). Requires real Supabase Auth + REST access:
// set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and
// SUPABASE_SERVICE_ROLE_KEY (the same variables the app uses). Skips cleanly when unset.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

describe.runIf(canRun)('RLS tenant isolation (tenant A/B, anon, authenticated)', () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  let userA: SupabaseClient;
  let userB: SupabaseClient;

  const tenantAId = randomUUID();
  const tenantBId = randomUUID();
  const emailA = `nex012-a-${randomUUID()}@example.test`;
  const emailB = `nex012-b-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}!`;
  let userAId: string;
  let userBId: string;
  const clientAId = randomUUID();

  beforeAll(async () => {
    admin = createClient(url!, serviceRoleKey!);
    anon = createClient(url!, publishableKey!);

    const { error: tenantsError } = await admin.from('tenants').insert([
      {
        id: tenantAId,
        slug: `nex012-a-${tenantAId.slice(0, 8)}`,
        name: 'Tenant A',
        status: 'setup',
      },
      {
        id: tenantBId,
        slug: `nex012-b-${tenantBId.slice(0, 8)}`,
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

    const { error: clientError } = await admin.from('clients').insert({
      id: clientAId,
      tenant_id: tenantAId,
      name: 'Private Client A',
      phone_e164: '+351911111111',
    });
    if (clientError) throw clientError;

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

  it('authenticated owner sees their own tenant client', async () => {
    const { data, error } = await userA.from('clients').select('id').eq('id', clientAId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('authenticated owner from another tenant cannot see it', async () => {
    const { data, error } = await userB.from('clients').select('id').eq('id', clientAId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('anon cannot see private client data', async () => {
    const { data, error } = await anon.from('clients').select('id').eq('id', clientAId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('authenticated owner cannot insert a row claiming another tenant id', async () => {
    const { error } = await userB
      .from('clients')
      .insert({ tenant_id: tenantAId, name: 'Injected client', phone_e164: '+351922222222' });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it('authenticated owner cannot update another tenant client row', async () => {
    const { data, error } = await userB
      .from('clients')
      .update({ name: 'Hacked name' })
      .eq('id', clientAId)
      .select();
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('authenticated owner cannot delete another tenant client row', async () => {
    const { data, error } = await userB.from('clients').delete().eq('id', clientAId).select();
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('authenticated owner can update their own tenant client row', async () => {
    const { data, error } = await userA
      .from('clients')
      .update({ name: 'Updated by owner' })
      .eq('id', clientAId)
      .select();
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.name).toBe('Updated by owner');
  });
});
