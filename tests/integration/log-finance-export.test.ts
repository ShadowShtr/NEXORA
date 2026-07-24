import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Exercises log_finance_export (NEX-135,
// supabase/migrations/0034_log_finance_export.sql) through the same PostgREST boundary
// the export routes use. Requires the same env vars as publish-business.test.ts; skips
// cleanly when unset.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

describe.runIf(canRun)('log_finance_export (NEX-135)', () => {
  let admin: SupabaseClient;
  let userA: SupabaseClient;

  const tenantId = randomUUID();
  const email = `nex135-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}!`;
  let userId: string;
  const slug = `nex135-${tenantId.slice(0, 8)}`;

  beforeAll(async () => {
    admin = createClient(url!, serviceRoleKey!);
    userA = createClient(url!, publishableKey!);

    await admin.from('tenants').insert({ id: tenantId, slug, name: 'Tenant', status: 'active' });

    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error) throw created.error;
    userId = created.data.user.id;
    await admin
      .from('profiles')
      .insert({ user_id: userId, tenant_id: tenantId, role: 'owner', display_name: 'Owner' });

    const signIn = await userA.auth.signInWithPassword({ email, password });
    if (signIn.error) throw signIn.error;
  });

  afterAll(async () => {
    await admin.from('tenants').update({ status: 'deleted' }).eq('id', tenantId);
    await admin.auth.admin.deleteUser(userId);
  });

  it('is not callable by anon', async () => {
    const anon = createClient(url!, publishableKey!);
    const { error } = await anon.rpc('log_finance_export', {
      p_format: 'csv',
      p_view: 'day',
      p_range_days: 1,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it('rejects an invalid export format', async () => {
    const { error } = await userA.rpc('log_finance_export', {
      p_format: 'txt',
      p_view: 'day',
      p_range_days: 1,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('22023');
  });

  it("writes an audit_logs row scoped to the caller's own tenant, for each format", async () => {
    for (const format of ['csv', 'xlsx', 'pdf'] as const) {
      const { error } = await userA.rpc('log_finance_export', {
        p_format: format,
        p_view: 'custom',
        p_range_days: 366,
      });
      expect(error).toBeNull();
    }

    const audit = await admin
      .from('audit_logs')
      .select('action, resource_type, actor_user_id, tenant_id, metadata')
      .eq('tenant_id', tenantId)
      .eq('action', 'finance.exported')
      .order('id');
    expect(audit.data).toHaveLength(3);
    for (const [index, format] of ['csv', 'xlsx', 'pdf'].entries()) {
      expect(audit.data![index]).toMatchObject({
        action: 'finance.exported',
        resource_type: 'finance_export',
        actor_user_id: userId,
        tenant_id: tenantId,
      });
      expect(audit.data![index]!.metadata).toMatchObject({
        format,
        view: 'custom',
        range_days: 366, // the export routes already clamp any custom range to <=366
        // days (resolveCustomRange, tested since NEX-131) before this RPC is ever
        // called — this just confirms the logged value reflects that clamp faithfully.
      });
    }
  });
});
