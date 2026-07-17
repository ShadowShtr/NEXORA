import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Exercises RLS + integrity constraints on packages/package_services (generic
// tenant-scoped policy loop + composite tenant FKs, 0001/0002_*.sql) through the same
// PostgREST boundary the app uses. Same env vars as rls-tenant-isolation.test.ts; skips
// cleanly when unset.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

describe.runIf(canRun)('packages RLS and constraints (NEX-042)', () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  let userA: SupabaseClient;
  let userB: SupabaseClient;

  const tenantAId = randomUUID();
  const tenantBId = randomUUID();
  const emailA = `nex042-a-${randomUUID()}@example.test`;
  const emailB = `nex042-b-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}!`;
  let userAId: string;
  let userBId: string;
  const categoryAId = randomUUID();
  const serviceAId = randomUUID();
  const categoryBId = randomUUID();
  const serviceBId = randomUUID();
  const activePackageAId = randomUUID();
  const inactivePackageAId = randomUUID();

  beforeAll(async () => {
    admin = createClient(url!, serviceRoleKey!);
    anon = createClient(url!, publishableKey!);

    const { error: tenantsError } = await admin.from('tenants').insert([
      {
        id: tenantAId,
        slug: `nex042-a-${tenantAId.slice(0, 8)}`,
        name: 'Tenant A',
        status: 'setup',
      },
      {
        id: tenantBId,
        slug: `nex042-b-${tenantBId.slice(0, 8)}`,
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

    const { error: categoriesError } = await admin.from('service_categories').insert([
      { id: categoryAId, tenant_id: tenantAId, name: 'Manicure A' },
      { id: categoryBId, tenant_id: tenantBId, name: 'Manicure B' },
    ]);
    if (categoriesError) throw categoriesError;

    const { error: servicesError } = await admin.from('services').insert([
      {
        id: serviceAId,
        tenant_id: tenantAId,
        category_id: categoryAId,
        name: 'Verniz gel A',
        price_cents: 2500,
        duration_minutes: 60,
      },
      {
        id: serviceBId,
        tenant_id: tenantBId,
        category_id: categoryBId,
        name: 'Verniz gel B',
        price_cents: 2500,
        duration_minutes: 60,
      },
    ]);
    if (servicesError) throw servicesError;

    const { error: packagesError } = await admin.from('packages').insert([
      {
        id: activePackageAId,
        tenant_id: tenantAId,
        name: 'Pacote ativo A',
        price_cents: 4000,
        is_active: true,
      },
      {
        id: inactivePackageAId,
        tenant_id: tenantAId,
        name: 'Pacote inativo A',
        price_cents: 4000,
        is_active: false,
      },
    ]);
    if (packagesError) throw packagesError;

    const { error: itemsError } = await admin.from('package_services').insert([
      { tenant_id: tenantAId, package_id: activePackageAId, service_id: serviceAId },
      { tenant_id: tenantAId, package_id: inactivePackageAId, service_id: serviceAId },
    ]);
    if (itemsError) throw itemsError;

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

  it('owner sees their own tenant packages and items', async () => {
    const packages = await userA.from('packages').select('id').eq('tenant_id', tenantAId);
    expect(packages.error).toBeNull();
    expect(packages.data).toHaveLength(2);

    const items = await userA
      .from('package_services')
      .select('package_id, service_id')
      .eq('package_id', activePackageAId);
    expect(items.error).toBeNull();
    expect(items.data).toMatchObject([{ service_id: serviceAId }]);
  });

  it('owner from another tenant cannot see them', async () => {
    const packages = await userB.from('packages').select('id').eq('tenant_id', tenantAId);
    expect(packages.error).toBeNull();
    expect(packages.data).toHaveLength(0);
  });

  it('anon can see an active package (public catalog policy) but not an inactive one', async () => {
    const active = await anon.from('packages').select('id').eq('id', activePackageAId);
    expect(active.error).toBeNull();
    expect(active.data).toHaveLength(1);

    const inactive = await anon.from('packages').select('id').eq('id', inactivePackageAId);
    expect(inactive.error).toBeNull();
    expect(inactive.data).toHaveLength(0);
  });

  it('a duplicate package name within the same tenant is rejected', async () => {
    const { error } = await userA
      .from('packages')
      .insert({ tenant_id: tenantAId, name: 'Pacote ativo A', price_cents: 1000 });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23505');
  });

  it('rejects a negative package price', async () => {
    const { error } = await userA
      .from('packages')
      .insert({ tenant_id: tenantAId, name: 'Preço inválido', price_cents: -100 });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23514');
  });

  it('rejects adding the same service to a package twice (no duplicate items)', async () => {
    const { error } = await userA
      .from('package_services')
      .insert({ tenant_id: tenantAId, package_id: activePackageAId, service_id: serviceAId });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23505');
  });

  it('rejects an item referencing a service from another tenant (composite FK, NEX-011)', async () => {
    const { error } = await userA.from('package_services').insert({
      tenant_id: tenantAId,
      package_id: activePackageAId,
      service_id: serviceBId,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23503');
  });
});
