import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Exercises invariants added in supabase/migrations/0002_harden_tenant_fk_integrity.sql
// directly against Postgres (bypassing RLS, which NEX-012/015 cover). Requires a real
// database: set TEST_DATABASE_URL to a disposable dev/CI Postgres connection string.
// Skips cleanly when unset so `npm test` stays green without one configured.
const connectionString = process.env.TEST_DATABASE_URL;

describe.runIf(Boolean(connectionString))('schema invariants (0001 + 0002 hardening)', () => {
  let client: Client;
  const tenantAId = randomUUID();
  const tenantBId = randomUUID();
  const categoryAId = randomUUID();
  const clientAId = randomUUID();
  const appointmentAId = randomUUID();

  function bookingTokenHash(seed: string) {
    return seed.padEnd(64, '0').slice(0, 64);
  }

  beforeAll(async () => {
    client = new Client({ connectionString });
    await client.connect();

    for (const [id, slug] of [
      [tenantAId, `test-a-${tenantAId.slice(0, 8)}`],
      [tenantBId, `test-b-${tenantBId.slice(0, 8)}`],
    ]) {
      await client.query(
        `insert into public.tenants (id, slug, name, status) values ($1, $2, 'Test Tenant', 'setup')`,
        [id, slug],
      );
    }

    await client.query(
      `insert into public.service_categories (id, tenant_id, name) values ($1, $2, 'Category A')`,
      [categoryAId, tenantAId],
    );

    await client.query(
      `insert into public.clients (id, tenant_id, name, phone_e164) values ($1, $2, 'Client A', '+351910000001')`,
      [clientAId, tenantAId],
    );

    await client.query(
      `insert into public.appointments
         (id, tenant_id, client_id, source, start_at, end_at, blocked_until, expected_total_cents, booking_token_hash)
       values ($1, $2, $3, 'admin', now() + interval '1 day', now() + interval '1 day 30 minutes',
               now() + interval '1 day 45 minutes', 2500, $4)`,
      [appointmentAId, tenantAId, clientAId, bookingTokenHash(appointmentAId)],
    );
  });

  afterAll(async () => {
    await client.query(`delete from public.tenants where id = any($1::uuid[])`, [
      [tenantAId, tenantBId],
    ]);
    await client.end();
  });

  it('rejects a service referencing a category from a different tenant', async () => {
    await expect(
      client.query(
        `insert into public.services (tenant_id, category_id, name, price_cents, duration_minutes)
         values ($1, $2, 'Cross-tenant service', 1000, 30)`,
        [tenantBId, categoryAId],
      ),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('rejects an appointment referencing a client from a different tenant', async () => {
    await expect(
      client.query(
        `insert into public.appointments
           (tenant_id, client_id, source, start_at, end_at, blocked_until, expected_total_cents, booking_token_hash)
         values ($1, $2, 'admin', now() + interval '2 day', now() + interval '2 day 30 minutes',
                 now() + interval '2 day 45 minutes', 2500, $3)`,
        [tenantBId, clientAId, bookingTokenHash(randomUUID())],
      ),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('requires source_id for service/package appointment items', async () => {
    await expect(
      client.query(
        `insert into public.appointment_items
           (tenant_id, appointment_id, source_type, source_id, description, unit_price_cents)
         values ($1, $2, 'service', null, 'Missing source_id', 1000)`,
        [tenantAId, appointmentAId],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('allows manual_extra/discount appointment items without source_id', async () => {
    await expect(
      client.query(
        `insert into public.appointment_items
           (tenant_id, appointment_id, source_type, source_id, description, unit_price_cents)
         values ($1, $2, 'manual_extra', null, 'Ad-hoc extra', 500)`,
        [tenantAId, appointmentAId],
      ),
    ).resolves.toMatchObject({ rowCount: 1 });
  });

  it('rejects a positive unit_price_cents on a discount line', async () => {
    await expect(
      client.query(
        `insert into public.appointment_items
           (tenant_id, appointment_id, source_type, source_id, description, unit_price_cents)
         values ($1, $2, 'discount', null, 'Bad discount sign', 500)`,
        [tenantAId, appointmentAId],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('accepts a negative unit_price_cents on a discount line', async () => {
    await expect(
      client.query(
        `insert into public.appointment_items
           (tenant_id, appointment_id, source_type, source_id, description, unit_price_cents)
         values ($1, $2, 'discount', null, 'Loyalty discount', -500)`,
        [tenantAId, appointmentAId],
      ),
    ).resolves.toMatchObject({ rowCount: 1 });
  });

  it('bumps updated_at automatically on UPDATE', async () => {
    const before = await client.query(`select updated_at from public.tenants where id = $1`, [
      tenantAId,
    ]);
    await new Promise((resolve) => setTimeout(resolve, 10));
    await client.query(`update public.tenants set name = 'Test Tenant Renamed' where id = $1`, [
      tenantAId,
    ]);
    const after = await client.query(`select updated_at from public.tenants where id = $1`, [
      tenantAId,
    ]);
    expect(new Date(after.rows[0].updated_at).getTime()).toBeGreaterThan(
      new Date(before.rows[0].updated_at).getTime(),
    );
  });
});
