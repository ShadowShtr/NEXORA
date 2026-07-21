import { randomUUID, randomBytes } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Exercises resolve_booking_lookup_code (supabase/migrations/0018_booking_lookup_code.sql)
// directly against Postgres. Requires TEST_DATABASE_URL; skips cleanly when unset (same
// pattern as create-public-booking.test.ts).
const connectionString = process.env.TEST_DATABASE_URL;

function idempotencyKey() {
  return randomBytes(32).toString('hex');
}

describe.runIf(Boolean(connectionString))('resolve_booking_lookup_code', () => {
  let client: Client;
  const tenantId = randomUUID();
  const categoryId = randomUUID();
  const serviceId = randomUUID();

  beforeAll(async () => {
    client = new Client({ connectionString });
    await client.connect();

    await client.query(
      `insert into public.tenants (id, slug, name, status) values ($1, $2, 'Lookup Code Tenant', 'active')`,
      [tenantId, `nexlookup-${tenantId.slice(0, 8)}`],
    );
    await client.query(
      `insert into public.business_settings (tenant_id, buffer_minutes, published_at, professional_name, timezone)
       values ($1, 15, now(), 'Joana', 'Europe/Lisbon')`,
      [tenantId],
    );
    await client.query(
      `insert into public.service_categories (id, tenant_id, name) values ($1, $2, 'Manicure')`,
      [categoryId, tenantId],
    );
    await client.query(
      `insert into public.services (id, tenant_id, category_id, name, price_cents, duration_minutes, is_active)
       values ($1, $2, $3, 'Verniz Gel', 2500, 45, true)`,
      [serviceId, tenantId, categoryId],
    );
  });

  afterAll(async () => {
    await client.query(`delete from public.appointments where tenant_id = $1`, [tenantId]);
    await client.query(`delete from public.clients where tenant_id = $1`, [tenantId]);
    await client.query(`update public.tenants set status = 'deleted' where id = $1`, [tenantId]);
    await client.end();
  });

  it('resolves a booking by its plaintext lookup code', async () => {
    const startAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
    const created = await client.query(
      `select * from public.create_public_booking($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        tenantId,
        'Ana Cliente',
        '+351911111111',
        null,
        [serviceId],
        null,
        startAt,
        idempotencyKey(),
      ],
    );
    const lookupCode = created.rows[0].lookup_code as string;

    const resolved = await client.query(`select * from public.resolve_booking_lookup_code($1)`, [
      lookupCode,
    ]);
    expect(resolved.rows).toHaveLength(1);
    expect(resolved.rows[0]).toMatchObject({
      appointment_id: created.rows[0].appointment_id,
      status: 'confirmed',
      tenant_name: 'Lookup Code Tenant',
      professional_name: 'Joana',
    });
    expect(Number(resolved.rows[0].total_cents)).toBe(2500);
  });

  it('is case-insensitive (accepts lowercase input, mirroring the RPC upper()ing it)', async () => {
    const startAt = new Date(Date.now() + 26 * 60 * 60_000).toISOString();
    const created = await client.query(
      `select * from public.create_public_booking($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        tenantId,
        'Beatriz Cliente',
        '+351922222222',
        null,
        [serviceId],
        null,
        startAt,
        idempotencyKey(),
      ],
    );
    const lookupCode = (created.rows[0].lookup_code as string).toLowerCase();

    const resolved = await client.query(`select * from public.resolve_booking_lookup_code($1)`, [
      lookupCode,
    ]);
    expect(resolved.rows).toHaveLength(1);
  });

  it('returns no rows for an unknown code', async () => {
    const resolved = await client.query(`select * from public.resolve_booking_lookup_code($1)`, [
      'ZZZZZZZZ',
    ]);
    expect(resolved.rows).toHaveLength(0);
  });

  it('returns no rows for a malformed (wrong-length) code, same as an unknown one', async () => {
    const tooShort = await client.query(`select * from public.resolve_booking_lookup_code($1)`, [
      'ABC',
    ]);
    const tooLong = await client.query(`select * from public.resolve_booking_lookup_code($1)`, [
      'ABCDEFGHIJ',
    ]);
    expect(tooShort.rows).toHaveLength(0);
    expect(tooLong.rows).toHaveLength(0);
  });

  it('returns no rows for a null code', async () => {
    const resolved = await client.query(`select * from public.resolve_booking_lookup_code($1)`, [
      null,
    ]);
    expect(resolved.rows).toHaveLength(0);
  });
});
