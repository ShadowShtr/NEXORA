import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Exercises RLS on service_categories (generic tenant-scoped policy loop,
// 0001_initial.sql) through the same PostgREST boundary the app uses. Same env vars as
// rls-tenant-isolation.test.ts; skips cleanly when unset.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

describe.runIf(canRun)('service_categories RLS (NEX-040)', () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  let userA: SupabaseClient;
  let userB: SupabaseClient;

  const tenantAId = randomUUID();
  const tenantBId = randomUUID();
  const emailA = `nex040-a-${randomUUID()}@example.test`;
  const emailB = `nex040-b-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}!`;
  let userAId: string;
  let userBId: string;
  const categoryAId = randomUUID();
  const hiddenCategoryAId = randomUUID();

  beforeAll(async () => {
    admin = createClient(url!, serviceRoleKey!);
    anon = createClient(url!, publishableKey!);

    const { error: tenantsError } = await admin.from('tenants').insert([
      {
        id: tenantAId,
        slug: `nex040-a-${tenantAId.slice(0, 8)}`,
        name: 'Tenant A',
        status: 'setup',
      },
      {
        id: tenantBId,
        slug: `nex040-b-${tenantBId.slice(0, 8)}`,
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

    const { error: categoryError } = await admin
      .from('service_categories')
      .insert({ id: categoryAId, tenant_id: tenantAId, name: 'Manicure Privada A' });
    if (categoryError) throw categoryError;

    const { error: hiddenCategoryError } = await admin.from('service_categories').insert({
      id: hiddenCategoryAId,
      tenant_id: tenantAId,
      name: 'Categoria Oculta A',
      is_visible: false,
    });
    if (hiddenCategoryError) throw hiddenCategoryError;

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

  it('owner sees their own tenant category', async () => {
    const { data, error } = await userA
      .from('service_categories')
      .select('id')
      .eq('id', categoryAId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('owner from another tenant cannot see it', async () => {
    const { data, error } = await userB
      .from('service_categories')
      .select('id')
      .eq('id', categoryAId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('anon can see a visible category (public catalog policy) but not a hidden one', async () => {
    const visible = await anon.from('service_categories').select('id').eq('id', categoryAId);
    expect(visible.error).toBeNull();
    expect(visible.data).toHaveLength(1);

    const hidden = await anon.from('service_categories').select('id').eq('id', hiddenCategoryAId);
    expect(hidden.error).toBeNull();
    expect(hidden.data).toHaveLength(0);
  });

  it('owner cannot insert a category claiming another tenant id', async () => {
    const { error } = await userB
      .from('service_categories')
      .insert({ tenant_id: tenantAId, name: 'Injetada' });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it('owner cannot rename another tenant category', async () => {
    const { data, error } = await userB
      .from('service_categories')
      .update({ name: 'Hacked' })
      .eq('id', categoryAId)
      .select();
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('a duplicate category name within the same tenant is rejected', async () => {
    const { error: firstError } = await userA
      .from('service_categories')
      .insert({ tenant_id: tenantAId, name: 'Sobrancelhas' });
    expect(firstError).toBeNull();

    const { error: secondError } = await userA
      .from('service_categories')
      .insert({ tenant_id: tenantAId, name: 'Sobrancelhas' });
    expect(secondError).not.toBeNull();
    expect(secondError?.code).toBe('23505');
  });
});
