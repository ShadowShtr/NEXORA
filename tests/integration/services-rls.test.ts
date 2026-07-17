import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Exercises RLS on services (generic tenant-scoped policy loop, 0001_initial.sql)
// through the same PostgREST boundary the app uses. Same env vars as
// rls-tenant-isolation.test.ts; skips cleanly when unset.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

describe.runIf(canRun)('services RLS and constraints (NEX-041)', () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  let userA: SupabaseClient;
  let userB: SupabaseClient;

  const tenantAId = randomUUID();
  const tenantBId = randomUUID();
  const emailA = `nex041-a-${randomUUID()}@example.test`;
  const emailB = `nex041-b-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}!`;
  let userAId: string;
  let userBId: string;
  const categoryAId = randomUUID();
  const activeServiceAId = randomUUID();
  const inactiveServiceAId = randomUUID();

  beforeAll(async () => {
    admin = createClient(url!, serviceRoleKey!);
    anon = createClient(url!, publishableKey!);

    const { error: tenantsError } = await admin.from('tenants').insert([
      {
        id: tenantAId,
        slug: `nex041-a-${tenantAId.slice(0, 8)}`,
        name: 'Tenant A',
        status: 'setup',
      },
      {
        id: tenantBId,
        slug: `nex041-b-${tenantBId.slice(0, 8)}`,
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
      .insert({ id: categoryAId, tenant_id: tenantAId, name: 'Manicure A' });
    if (categoryError) throw categoryError;

    const { error: servicesError } = await admin.from('services').insert([
      {
        id: activeServiceAId,
        tenant_id: tenantAId,
        category_id: categoryAId,
        name: 'Verniz gel A',
        price_cents: 2500,
        duration_minutes: 60,
        is_active: true,
      },
      {
        id: inactiveServiceAId,
        tenant_id: tenantAId,
        category_id: categoryAId,
        name: 'Serviço inativo A',
        price_cents: 1000,
        duration_minutes: 30,
        is_active: false,
      },
    ]);
    if (servicesError) throw servicesError;

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

  it('owner sees their own tenant services', async () => {
    const { data, error } = await userA.from('services').select('id').eq('tenant_id', tenantAId);
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });

  it('owner from another tenant cannot see them', async () => {
    const { data, error } = await userB.from('services').select('id').eq('tenant_id', tenantAId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('anon can see an active service (public catalog policy) but not an inactive one', async () => {
    const active = await anon.from('services').select('id').eq('id', activeServiceAId);
    expect(active.error).toBeNull();
    expect(active.data).toHaveLength(1);

    const inactive = await anon.from('services').select('id').eq('id', inactiveServiceAId);
    expect(inactive.error).toBeNull();
    expect(inactive.data).toHaveLength(0);
  });

  it('owner cannot insert a service claiming another tenant id', async () => {
    const { error } = await userB.from('services').insert({
      tenant_id: tenantAId,
      category_id: categoryAId,
      name: 'Injetado',
      price_cents: 100,
      duration_minutes: 30,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it('a duplicate service name within the same tenant is rejected', async () => {
    const { error } = await userA.from('services').insert({
      tenant_id: tenantAId,
      category_id: categoryAId,
      name: 'Verniz gel A',
      price_cents: 999,
      duration_minutes: 30,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23505');
  });

  it('rejects a duration outside the 5–720 minute range', async () => {
    const tooShort = await userA.from('services').insert({
      tenant_id: tenantAId,
      category_id: categoryAId,
      name: 'Curto demais',
      price_cents: 500,
      duration_minutes: 1,
    });
    expect(tooShort.error).not.toBeNull();
    expect(tooShort.error?.code).toBe('23514');

    const tooLong = await userA.from('services').insert({
      tenant_id: tenantAId,
      category_id: categoryAId,
      name: 'Longo demais',
      price_cents: 500,
      duration_minutes: 721,
    });
    expect(tooLong.error).not.toBeNull();
    expect(tooLong.error?.code).toBe('23514');
  });

  it('rejects a negative price', async () => {
    const { error } = await userA.from('services').insert({
      tenant_id: tenantAId,
      category_id: categoryAId,
      name: 'Preço negativo',
      price_cents: -100,
      duration_minutes: 30,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23514');
  });
});
