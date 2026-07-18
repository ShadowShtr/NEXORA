import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Exercises update_client_private_notes (NEX-093,
// supabase/migrations/0010_update_client_private_notes.sql) through the same
// PostgREST boundary the app uses. Requires the same env vars as
// publish-business.test.ts; skips cleanly when unset.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

describe.runIf(canRun)('update_client_private_notes (NEX-093)', () => {
  let admin: SupabaseClient;
  let owner: SupabaseClient;
  let otherOwner: SupabaseClient;

  const tenantId = randomUUID();
  const otherTenantId = randomUUID();
  const email = `nex093-${randomUUID()}@example.test`;
  const otherEmail = `nex093-other-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}!`;
  let ownerId: string;
  let otherOwnerId: string;
  const slug = `nex093-${tenantId.slice(0, 8)}`;
  const otherSlug = `nex093-other-${otherTenantId.slice(0, 8)}`;
  let clientId: string;

  beforeAll(async () => {
    admin = createClient(url!, serviceRoleKey!);
    owner = createClient(url!, publishableKey!);
    otherOwner = createClient(url!, publishableKey!);

    await admin.from('tenants').insert([
      { id: tenantId, slug, name: 'Notes Tenant', status: 'active' },
      { id: otherTenantId, slug: otherSlug, name: 'Other Notes Tenant', status: 'active' },
    ]);

    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error) throw created.error;
    ownerId = created.data.user.id;
    const createdOther = await admin.auth.admin.createUser({
      email: otherEmail,
      password,
      email_confirm: true,
    });
    if (createdOther.error) throw createdOther.error;
    otherOwnerId = createdOther.data.user.id;

    await admin.from('profiles').insert([
      { user_id: ownerId, tenant_id: tenantId, role: 'owner', display_name: 'Owner' },
      {
        user_id: otherOwnerId,
        tenant_id: otherTenantId,
        role: 'owner',
        display_name: 'Other Owner',
      },
    ]);

    const signIn = await owner.auth.signInWithPassword({ email, password });
    if (signIn.error) throw signIn.error;
    const signInOther = await otherOwner.auth.signInWithPassword({
      email: otherEmail,
      password,
    });
    if (signInOther.error) throw signInOther.error;

    const { data: client } = await admin
      .from('clients')
      .insert({ tenant_id: tenantId, name: 'Client', phone_e164: '+351911111111' })
      .select('id')
      .single();
    clientId = client!.id;
  });

  afterAll(async () => {
    await admin.from('tenants').delete().in('id', [tenantId, otherTenantId]);
    await admin.auth.admin.deleteUser(ownerId);
    await admin.auth.admin.deleteUser(otherOwnerId);
  });

  it('is not callable by anon', async () => {
    const anon = createClient(url!, publishableKey!);
    const { error } = await anon.rpc('update_client_private_notes', {
      p_client_id: clientId,
      p_private_notes: 'x',
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it("rejects updating another tenant's client", async () => {
    const { error } = await otherOwner.rpc('update_client_private_notes', {
      p_client_id: clientId,
      p_private_notes: 'Tentativa de outro tenant',
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('22023');

    const client = await admin.from('clients').select('private_notes').eq('id', clientId).single();
    expect(client.data?.private_notes).toBeNull();
  });

  it('updates the note and writes an audit log entry without storing the note contents in it', async () => {
    const note = 'Prefere agendar de manhã. Alergia a acetona sem acetona.';
    const { error } = await owner.rpc('update_client_private_notes', {
      p_client_id: clientId,
      p_private_notes: note,
    });
    expect(error).toBeNull();

    const client = await admin.from('clients').select('private_notes').eq('id', clientId).single();
    expect(client.data?.private_notes).toBe(note);

    const audit = await admin
      .from('audit_logs')
      .select('action, resource_type, actor_user_id, metadata')
      .eq('resource_id', clientId)
      .eq('action', 'client.private_notes_updated')
      .single();
    expect(audit.data).toMatchObject({
      action: 'client.private_notes_updated',
      resource_type: 'client',
      actor_user_id: ownerId,
    });
    // Log redaction: the audit trail records that the note changed, never its content.
    expect(JSON.stringify(audit.data?.metadata ?? {})).not.toContain('acetona');
    expect(JSON.stringify(audit.data?.metadata ?? {})).not.toContain('manhã');
  });

  it('rejects a note longer than 2000 characters', async () => {
    const { error } = await owner.rpc('update_client_private_notes', {
      p_client_id: clientId,
      p_private_notes: 'a'.repeat(2001),
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('22001');
  });

  it('clears the note when given an empty string', async () => {
    const first = await owner.rpc('update_client_private_notes', {
      p_client_id: clientId,
      p_private_notes: 'Nota temporária',
    });
    expect(first.error).toBeNull();

    const second = await owner.rpc('update_client_private_notes', {
      p_client_id: clientId,
      p_private_notes: '',
    });
    expect(second.error).toBeNull();

    const client = await admin.from('clients').select('private_notes').eq('id', clientId).single();
    expect(client.data?.private_notes).toBeNull();
  });
});
