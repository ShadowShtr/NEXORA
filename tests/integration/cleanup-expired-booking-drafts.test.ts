import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// NEX-161: "Retenção e limpeza de drafts", required test category "Teste de
// expiração". cleanup_expired_booking_drafts (supabase/migrations/0035) is the
// proactive half of draft cleanup — resumeBookingDraft's lazy delete only ever runs
// for a draft someone actively tries to resume.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

describe.runIf(canRun)('cleanup_expired_booking_drafts (NEX-161)', () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;

  const tenantId = randomUUID();
  const slug = `nex161-${tenantId.slice(0, 8)}`;
  let expiredDraftId: string;
  let activeDraftId: string;

  beforeAll(async () => {
    admin = createClient(url!, serviceRoleKey!);
    anon = createClient(url!, publishableKey!);

    const { error: tenantError } = await admin
      .from('tenants')
      .insert({ id: tenantId, slug, name: 'Cleanup Test Tenant', status: 'active' });
    if (tenantError) throw tenantError;

    const now = Date.now();
    const { data: expired, error: expiredError } = await admin
      .from('booking_drafts')
      .insert({
        tenant_id: tenantId,
        resume_token_hash: randomUUID().replace(/-/g, '').padEnd(64, '0'),
        encrypted_payload: 'irrelevant-for-this-test',
        created_at: new Date(now - 25 * 60 * 60_000).toISOString(),
        expires_at: new Date(now - 60 * 60_000).toISOString(),
      })
      .select('id')
      .single();
    if (expiredError) throw expiredError;
    expiredDraftId = expired.id;

    const { data: active, error: activeError } = await admin
      .from('booking_drafts')
      .insert({
        tenant_id: tenantId,
        resume_token_hash: randomUUID().replace(/-/g, '').padEnd(64, '1'),
        encrypted_payload: 'irrelevant-for-this-test',
        expires_at: new Date(now + 60 * 60_000).toISOString(),
      })
      .select('id')
      .single();
    if (activeError) throw activeError;
    activeDraftId = active.id;
  });

  afterAll(async () => {
    await admin.from('booking_drafts').delete().eq('tenant_id', tenantId);
    await admin.from('tenants').update({ status: 'deleted' }).eq('id', tenantId);
  });

  it('is rejected for anon and authenticated (service-role only, like provision_tenant_owner)', async () => {
    const { error } = await anon.rpc('cleanup_expired_booking_drafts');
    expect(error?.code).toBe('42501');
  });

  it('deletes only the expired draft and reports how many it removed', async () => {
    const { data, error } = await admin.rpc('cleanup_expired_booking_drafts');
    expect(error).toBeNull();
    expect(data).toBeGreaterThanOrEqual(1);

    const { data: remaining } = await admin
      .from('booking_drafts')
      .select('id')
      .eq('tenant_id', tenantId);
    const remainingIds = (remaining ?? []).map((row) => row.id);
    expect(remainingIds).not.toContain(expiredDraftId);
    expect(remainingIds).toContain(activeDraftId);
  });
});
