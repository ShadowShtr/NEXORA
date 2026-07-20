import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Exercises RLS on the client-photos Storage bucket (0019_client_photos_storage.sql) and
// on client_photos itself (0001_initial.sql policy loop + 0002's composite FK) through
// the same PostgREST/Storage boundary the app uses. Same env vars as
// rls-tenant-isolation.test.ts; skips cleanly when unset.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

describe.runIf(canRun)('client-photos storage RLS (NEX-094)', () => {
  let admin: SupabaseClient;
  let userA: SupabaseClient;
  let userB: SupabaseClient;

  const tenantAId = randomUUID();
  const tenantBId = randomUUID();
  const emailA = `nex094-a-${randomUUID()}@example.test`;
  const emailB = `nex094-b-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}!`;
  let userAId: string;
  let userBId: string;
  const clientAId = randomUUID();
  const clientBId = randomUUID();

  const photoBytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]); // not a real image; storage RLS doesn't decode content
  const objectPathA = `${tenantAId}/${clientAId}/${randomUUID()}.jpg`;

  beforeAll(async () => {
    admin = createClient(url!, serviceRoleKey!);

    const { error: tenantsError } = await admin.from('tenants').insert([
      {
        id: tenantAId,
        slug: `nex094-a-${tenantAId.slice(0, 8)}`,
        name: 'Tenant A',
        status: 'setup',
      },
      {
        id: tenantBId,
        slug: `nex094-b-${tenantBId.slice(0, 8)}`,
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

    const { error: clientsError } = await admin.from('clients').insert([
      { id: clientAId, tenant_id: tenantAId, name: 'Cliente A', phone_e164: '+351910000001' },
      { id: clientBId, tenant_id: tenantBId, name: 'Cliente B', phone_e164: '+351910000002' },
    ]);
    if (clientsError) throw clientsError;

    userA = createClient(url!, publishableKey!);
    const signInA = await userA.auth.signInWithPassword({ email: emailA, password });
    if (signInA.error) throw signInA.error;

    userB = createClient(url!, publishableKey!);
    const signInB = await userB.auth.signInWithPassword({ email: emailB, password });
    if (signInB.error) throw signInB.error;
  });

  afterAll(async () => {
    await admin.storage.from('client-photos').remove([objectPathA]);
    await admin.from('tenants').delete().in('id', [tenantAId, tenantBId]);
    if (userAId) await admin.auth.admin.deleteUser(userAId);
    if (userBId) await admin.auth.admin.deleteUser(userBId);
  });

  it('owner can upload under their own tenant folder', async () => {
    const { error } = await userA.storage
      .from('client-photos')
      .upload(objectPathA, photoBytes, { contentType: 'image/jpeg' });
    expect(error).toBeNull();
  });

  it('owner cannot upload under another tenant folder', async () => {
    const foreignPath = `${tenantAId}/${clientAId}/${randomUUID()}.jpg`;
    const { error } = await userB.storage
      .from('client-photos')
      .upload(foreignPath, photoBytes, { contentType: 'image/jpeg' });
    expect(error).not.toBeNull();
  });

  it('owner can read back their own uploaded photo', async () => {
    const { data, error } = await userA.storage.from('client-photos').download(objectPathA);
    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });

  it('another tenant cannot read the photo, list its folder, or create a signed URL for it', async () => {
    const download = await userB.storage.from('client-photos').download(objectPathA);
    expect(download.error).not.toBeNull();

    // list() applies RLS as a row filter rather than erroring — an unreadable folder
    // simply comes back empty, the same shape as "nothing there", not a hard failure.
    const list = await userB.storage.from('client-photos').list(tenantAId);
    expect(list.error).toBeNull();
    expect(list.data).toEqual([]);

    const signed = await userB.storage.from('client-photos').createSignedUrl(objectPathA, 60);
    expect(signed.error).not.toBeNull();
  });

  it('another tenant cannot delete the photo', async () => {
    const { error } = await userB.storage.from('client-photos').remove([objectPathA]);
    // Storage remove() on a row the caller cannot see resolves with no matching object
    // removed rather than a hard error — confirm by re-downloading as the owner.
    expect(error).toBeNull();
    const stillThere = await userA.storage.from('client-photos').download(objectPathA);
    expect(stillThere.error).toBeNull();
  });

  it('client_photos row insert is rejected across tenants (RLS) and across clients within the wrong tenant (composite FK)', async () => {
    const crossTenant = await userB.from('client_photos').insert({
      tenant_id: tenantAId,
      client_id: clientAId,
      kind: 'other',
      storage_path: objectPathA,
    });
    expect(crossTenant.error).not.toBeNull();
    expect(crossTenant.error?.code).toBe('42501');

    const mismatchedClient = await userA.from('client_photos').insert({
      tenant_id: tenantAId,
      client_id: clientBId,
      kind: 'other',
      storage_path: objectPathA,
    });
    expect(mismatchedClient.error).not.toBeNull();
    expect(mismatchedClient.error?.code).toBe('23503');
  });

  it('owner can insert and then see their own client_photos row; the other tenant cannot', async () => {
    const rowPath = `${tenantAId}/${clientAId}/${randomUUID()}.jpg`;
    const insert = await userA
      .from('client_photos')
      .insert({ tenant_id: tenantAId, client_id: clientAId, kind: 'before', storage_path: rowPath })
      .select('id')
      .single();
    expect(insert.error).toBeNull();

    const ownRead = await userA.from('client_photos').select('id').eq('id', insert.data!.id);
    expect(ownRead.data).toHaveLength(1);

    const foreignRead = await userB.from('client_photos').select('id').eq('id', insert.data!.id);
    expect(foreignRead.data).toHaveLength(0);
  });
});
