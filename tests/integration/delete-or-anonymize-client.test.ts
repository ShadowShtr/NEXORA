import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// NEX-163: "Apagar/anonimizar cliente — workflow preserva obrigações e remove
// storage", required test category "Referential/restore considerations".
// appointments.client_id is ON DELETE RESTRICT (0001_initial.sql) — the two branches
// below are exactly what that constraint forces: no history → real delete; any
// history → anonymize in place, keeping the financial/audit trail intact.
//
// Called through real signed-in owner sessions throughout (not the service-role
// client) — delete_or_anonymize_client is granted only to `authenticated`
// (supabase/migrations/0036), same as provision_tenant_owner is granted only to
// `service_role` in the opposite direction (0003): service_role has no EXECUTE grant
// here at all, and current_tenant_id() has nothing to resolve without a real
// auth.uid() from a signed-in session — this mirrors exactly how the app itself calls
// it (src/features/clients/delete-actions.ts, via requireProfile()'s cookie-scoped
// client), the same pattern tests/integration/catalog-rls.test.ts already uses for
// cross-tenant checks.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

describe.runIf(canRun)('delete_or_anonymize_client (NEX-163)', () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  let ownerA: SupabaseClient;
  let ownerB: SupabaseClient;

  const tenantAId = randomUUID();
  const tenantBId = randomUUID();
  const slugA = `nex163a-${tenantAId.slice(0, 8)}`;
  const slugB = `nex163b-${tenantBId.slice(0, 8)}`;
  const categoryId = randomUUID();
  const serviceId = randomUUID();
  const emailA = `nex163-a-${randomUUID()}@example.test`;
  const emailB = `nex163-b-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}!`;
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    admin = createClient(url!, serviceRoleKey!);
    anon = createClient(url!, publishableKey!);

    await admin.from('tenants').insert([
      { id: tenantAId, slug: slugA, name: 'NEX-163 Tenant A', status: 'active' },
      { id: tenantBId, slug: slugB, name: 'NEX-163 Tenant B', status: 'active' },
    ]);
    await admin
      .from('business_settings')
      .insert({ tenant_id: tenantAId, buffer_minutes: 15, published_at: new Date().toISOString() });
    await admin
      .from('service_categories')
      .insert({ id: categoryId, tenant_id: tenantAId, name: 'Manicure' });
    await admin.from('services').insert({
      id: serviceId,
      tenant_id: tenantAId,
      category_id: categoryId,
      name: 'Verniz Gel',
      price_cents: 3000,
      duration_minutes: 60,
      is_active: true,
    });

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

    await admin.from('profiles').insert([
      { user_id: userAId, tenant_id: tenantAId, role: 'owner', display_name: 'Owner A' },
      { user_id: userBId, tenant_id: tenantBId, role: 'owner', display_name: 'Owner B' },
    ]);

    ownerA = createClient(url!, publishableKey!);
    const signInA = await ownerA.auth.signInWithPassword({ email: emailA, password });
    if (signInA.error) throw signInA.error;

    ownerB = createClient(url!, publishableKey!);
    const signInB = await ownerB.auth.signInWithPassword({ email: emailB, password });
    if (signInB.error) throw signInB.error;
  });

  afterAll(async () => {
    await admin.from('appointments').delete().eq('tenant_id', tenantAId);
    await admin.from('clients').delete().in('tenant_id', [tenantAId, tenantBId]);
    await admin.auth.admin.deleteUser(userAId);
    await admin.auth.admin.deleteUser(userBId);
    await admin.from('tenants').update({ status: 'deleted' }).in('id', [tenantAId, tenantBId]);
  });

  it('is rejected for anon (granted only to authenticated, unlike public booking RPCs)', async () => {
    const { error } = await anon.rpc('delete_or_anonymize_client', { p_client_id: randomUUID() });
    expect(error?.code).toBe('42501');
  });

  it('hard-deletes a client with no appointment history, including her photos', async () => {
    const { data: client } = await admin
      .from('clients')
      .insert({ tenant_id: tenantAId, name: 'Sem Histórico', phone_e164: '+351911000001' })
      .select('id')
      .single();
    const clientId = client!.id;

    await admin.from('client_photos').insert({
      tenant_id: tenantAId,
      client_id: clientId,
      kind: 'other',
      storage_path: `${tenantAId}/${clientId}/x.jpg`,
    });

    const { data, error } = await ownerA
      .rpc('delete_or_anonymize_client', { p_client_id: clientId })
      .single<{ action: string; storage_paths: string[] }>();

    expect(error).toBeNull();
    expect(data?.action).toBe('deleted');
    expect(data?.storage_paths).toEqual([`${tenantAId}/${clientId}/x.jpg`]);

    const { data: remainingClient } = await admin
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .maybeSingle();
    expect(remainingClient).toBeNull();
    const { data: remainingPhotos } = await admin
      .from('client_photos')
      .select('id')
      .eq('client_id', clientId);
    expect(remainingPhotos).toEqual([]);
  });

  it('anonymizes a client with appointment history, preserving the appointment/payment trail', async () => {
    const { data: client } = await admin
      .from('clients')
      .insert({
        tenant_id: tenantAId,
        name: 'Com Histórico',
        phone_e164: '+351911000002',
        email: 'com-historico@example.test',
        private_notes: 'nota privada sensível',
        preferences: { colors: 'vermelho' },
      })
      .select('id')
      .single();
    const clientId = client!.id;

    const idempotencyKey = randomUUID().replace(/-/g, '').padEnd(64, '0');
    const { data: booking } = await anon
      .rpc('create_public_booking', {
        p_tenant_id: tenantAId,
        p_client_name: 'Com Histórico',
        p_client_phone_e164: '+351911000002',
        p_client_email: null,
        p_selected_service_ids: [serviceId],
        p_selected_package_id: null,
        p_start_at: new Date(Date.now() + 48 * 60 * 60_000).toISOString(),
        p_idempotency_key: idempotencyKey,
      })
      .single<{ appointment_id: string }>();

    await admin
      .from('appointments')
      .update({ client_id: clientId, client_observation: 'observação da cliente' })
      .eq('id', booking!.appointment_id);

    const { data, error } = await ownerA
      .rpc('delete_or_anonymize_client', { p_client_id: clientId })
      .single<{ action: string; storage_paths: string[] }>();

    expect(error).toBeNull();
    expect(data?.action).toBe('anonymized');

    const { data: anonymized } = await admin
      .from('clients')
      .select('name, phone_e164, email, private_notes, preferences, anonymized_at')
      .eq('id', clientId)
      .single();
    expect(anonymized!.name).toBe('Cliente removida');
    expect(anonymized!.phone_e164).toMatch(/^\+999\d{9}$/);
    expect(anonymized!.email).toBeNull();
    expect(anonymized!.private_notes).toBeNull();
    expect(anonymized!.preferences).toEqual({});
    expect(anonymized!.anonymized_at).not.toBeNull();

    const { data: appointment } = await admin
      .from('appointments')
      .select('client_id, expected_total_cents, client_observation')
      .eq('id', booking!.appointment_id)
      .single();
    expect(appointment!.client_id).toBe(clientId);
    expect(appointment!.expected_total_cents).toBe(3000);
    expect(appointment!.client_observation).toBeNull();
  });

  it("owner B cannot delete/anonymize owner A's client", async () => {
    const { data: client } = await admin
      .from('clients')
      .insert({ tenant_id: tenantAId, name: 'Protegida', phone_e164: '+351911000004' })
      .select('id')
      .single();
    const clientId = client!.id;

    const { error } = await ownerB.rpc('delete_or_anonymize_client', { p_client_id: clientId });
    expect(error?.code).toBe('22023');

    const { data: stillThere } = await admin
      .from('clients')
      .select('id, name')
      .eq('id', clientId)
      .maybeSingle();
    expect(stillThere?.name).toBe('Protegida');
  });
});
