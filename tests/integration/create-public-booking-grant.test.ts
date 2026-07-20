import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Confirms the EXECUTE grant on create_public_booking (NEX-064,
// supabase/migrations/0007_create_public_booking.sql) actually reaches anon through
// PostgREST — reading the migration's GRANT statement is not enough (ADR-008: this
// project grants EXECUTE to anon/authenticated directly on new public functions by
// default, so a wrong revoke/grant combination fails silently rather than loudly).
// Requires the same env vars as publish-business.test.ts; skips cleanly when unset.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

describe.runIf(canRun)('create_public_booking grant (NEX-064)', () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;

  const tenantId = randomUUID();
  const categoryId = randomUUID();
  const serviceId = randomUUID();
  const slug = `nex064-grant-${tenantId.slice(0, 8)}`;

  beforeAll(async () => {
    admin = createClient(url!, serviceRoleKey!);
    anon = createClient(url!, publishableKey!);

    const { error: tenantError } = await admin
      .from('tenants')
      .insert({ id: tenantId, slug, name: 'Grant Test Tenant', status: 'active' });
    if (tenantError) throw tenantError;

    const { error: settingsError } = await admin
      .from('business_settings')
      .insert({ tenant_id: tenantId, buffer_minutes: 15, published_at: new Date().toISOString() });
    if (settingsError) throw settingsError;

    const { error: categoryError } = await admin
      .from('service_categories')
      .insert({ id: categoryId, tenant_id: tenantId, name: 'Manicure' });
    if (categoryError) throw categoryError;

    const { error: serviceError } = await admin.from('services').insert({
      id: serviceId,
      tenant_id: tenantId,
      category_id: categoryId,
      name: 'Verniz Gel',
      price_cents: 3000,
      duration_minutes: 60,
      is_active: true,
    });
    if (serviceError) throw serviceError;
  });

  afterAll(async () => {
    await admin.from('appointments').delete().eq('tenant_id', tenantId);
    await admin.from('clients').delete().eq('tenant_id', tenantId);
    await admin.from('tenants').delete().eq('id', tenantId);
  });

  it('is callable by anon and returns a usable booking token', async () => {
    const idempotencyKey = randomUUID().replace(/-/g, '').padEnd(64, '0');
    const { data, error } = await anon
      .rpc('create_public_booking', {
        p_tenant_id: tenantId,
        p_client_name: 'Anon Visitor',
        p_client_phone_e164: '+351966666666',
        p_client_email: null,
        p_selected_service_ids: [serviceId],
        p_selected_package_id: null,
        p_start_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
        p_idempotency_key: idempotencyKey,
      })
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({ is_replay: false });
    expect((data as { booking_token: string }).booking_token).toHaveLength(64);
    expect((data as { lookup_code: string }).lookup_code).toMatch(
      /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/,
    );
  });
});

// Confirms the EXECUTE grant on resolve_booking_lookup_code
// (supabase/migrations/0018_booking_lookup_code.sql) also reaches anon through
// PostgREST — same ADR-008 concern as create_public_booking above.
describe.runIf(canRun)('resolve_booking_lookup_code grant', () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;

  const tenantId = randomUUID();
  const categoryId = randomUUID();
  const serviceId = randomUUID();
  const slug = `nex095b-grant-${tenantId.slice(0, 8)}`;
  let lookupCode: string;

  beforeAll(async () => {
    admin = createClient(url!, serviceRoleKey!);
    anon = createClient(url!, publishableKey!);

    await admin
      .from('tenants')
      .insert({ id: tenantId, slug, name: 'Lookup Grant Tenant', status: 'active' });
    await admin
      .from('business_settings')
      .insert({ tenant_id: tenantId, buffer_minutes: 15, published_at: new Date().toISOString() });
    await admin
      .from('service_categories')
      .insert({ id: categoryId, tenant_id: tenantId, name: 'Manicure' });
    await admin.from('services').insert({
      id: serviceId,
      tenant_id: tenantId,
      category_id: categoryId,
      name: 'Verniz Gel',
      price_cents: 3000,
      duration_minutes: 60,
      is_active: true,
    });

    const idempotencyKey = randomUUID().replace(/-/g, '').padEnd(64, '0');
    const { data } = await anon
      .rpc('create_public_booking', {
        p_tenant_id: tenantId,
        p_client_name: 'Anon Visitor',
        p_client_phone_e164: '+351977777777',
        p_client_email: null,
        p_selected_service_ids: [serviceId],
        p_selected_package_id: null,
        p_start_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
        p_idempotency_key: idempotencyKey,
      })
      .single<{ lookup_code: string }>();
    lookupCode = data!.lookup_code;
  });

  afterAll(async () => {
    await admin.from('appointments').delete().eq('tenant_id', tenantId);
    await admin.from('clients').delete().eq('tenant_id', tenantId);
    await admin.from('tenants').delete().eq('id', tenantId);
  });

  it('is callable by anon and resolves the booking created above', async () => {
    const { data, error } = await anon
      .rpc('resolve_booking_lookup_code', { p_code: lookupCode })
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({ status: 'confirmed', tenant_name: 'Lookup Grant Tenant' });
  });
});
