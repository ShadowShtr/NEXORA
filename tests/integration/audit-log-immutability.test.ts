import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Exercises the append-only guarantee added in
// supabase/migrations/0004_audit_logs_immutable.sql. Connects directly to Postgres
// (bypassing RLS, same as schema-invariants.test.ts) precisely because the guarantee
// under test — a BEFORE UPDATE/DELETE trigger — must hold even for privileged roles
// that RLS does not restrict (service_role has BYPASSRLS). Requires TEST_DATABASE_URL;
// skips cleanly when unset.
//
// Note: because the row really is append-only, this test cannot delete the audit_logs
// row it creates, nor the tenant it references — audit_logs.tenant_id is
// ON DELETE RESTRICT precisely so a tenant with audit history can never be hard-deleted
// (tenant removal in this product is a soft delete via tenant_status). One residual
// tenant + audit row per run is expected and acceptable on the disposable dev project
// (ADR-007).
const connectionString = process.env.TEST_DATABASE_URL;

describe.runIf(Boolean(connectionString))('audit_logs immutability (NEX-014)', () => {
  let client: Client;
  let auditId: number;
  const tenantId = randomUUID();

  beforeAll(async () => {
    client = new Client({ connectionString });
    await client.connect();

    await client.query(
      `insert into public.tenants (id, slug, name, status) values ($1, $2, 'Audit Test Tenant', 'setup')`,
      [tenantId, `nex014-${tenantId.slice(0, 8)}`],
    );

    const inserted = await client.query(
      `insert into public.audit_logs (tenant_id, action, resource_type, metadata)
       values ($1, 'test.action', 'test', '{}'::jsonb) returning id`,
      [tenantId],
    );
    auditId = inserted.rows[0].id;
  });

  afterAll(async () => {
    await client.end();
  });

  it('allows inserting a new audit log row', () => {
    expect(auditId).toBeTruthy();
  });

  it('rejects hard-deleting a tenant that has audit history', async () => {
    await expect(
      client.query(`delete from public.tenants where id = $1`, [tenantId]),
    ).rejects.toMatchObject({
      code: '23503',
    });
  });

  it('rejects updating an existing audit log row, even as a privileged role', async () => {
    await expect(
      client.query(`update public.audit_logs set action = 'tampered' where id = $1`, [auditId]),
    ).rejects.toMatchObject({ message: expect.stringContaining('append-only') });
  });

  it('rejects deleting an existing audit log row, even as a privileged role', async () => {
    await expect(
      client.query(`delete from public.audit_logs where id = $1`, [auditId]),
    ).rejects.toMatchObject({
      message: expect.stringContaining('append-only'),
    });
  });
});
