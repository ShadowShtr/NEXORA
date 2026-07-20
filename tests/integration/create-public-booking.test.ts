import { randomUUID, randomBytes } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

// Exercises create_public_booking (NEX-064,
// supabase/migrations/0007_create_public_booking.sql) directly against Postgres
// (bypassing PostgREST) so transactional rollback and real concurrency can be observed
// precisely — a REST-level test can only see the final committed state, not whether a
// failed item insert actually rolled back the client upsert too. Requires
// TEST_DATABASE_URL; skips cleanly when unset (same pattern as
// schema-invariants.test.ts).
const connectionString = process.env.TEST_DATABASE_URL;

function idempotencyKey() {
  return randomBytes(32).toString('hex');
}

describe.runIf(Boolean(connectionString))('create_public_booking (NEX-064)', () => {
  let client: Client;
  const tenantId = randomUUID();
  const categoryId = randomUUID();
  const serviceId = randomUUID();
  const serviceMinutes = 60;
  const servicePriceCents = 3000;

  beforeAll(async () => {
    client = new Client({ connectionString });
    await client.connect();

    await client.query(
      `insert into public.tenants (id, slug, name, status) values ($1, $2, 'Booking Test Tenant', 'active')`,
      [tenantId, `nex064-${tenantId.slice(0, 8)}`],
    );
    await client.query(
      `insert into public.business_settings (tenant_id, buffer_minutes, published_at) values ($1, 15, now())`,
      [tenantId],
    );
    await client.query(
      `insert into public.service_categories (id, tenant_id, name) values ($1, $2, 'Manicure')`,
      [categoryId, tenantId],
    );
    await client.query(
      `insert into public.services (id, tenant_id, category_id, name, price_cents, duration_minutes, is_active)
       values ($1, $2, $3, 'Verniz Gel', $4, $5, true)`,
      [serviceId, tenantId, categoryId, servicePriceCents, serviceMinutes],
    );
  });

  afterEach(async () => {
    await client.query(`delete from public.appointments where tenant_id = $1`, [tenantId]);
    await client.query(`delete from public.clients where tenant_id = $1`, [tenantId]);
  });

  afterAll(async () => {
    await client.query(`delete from public.tenants where id = $1`, [tenantId]);
    await client.end();
  });

  it('atomically creates client, appointment_items, appointment and reminder', async () => {
    const key = idempotencyKey();
    const startAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();

    const result = await client.query(
      `select * from public.create_public_booking($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        tenantId,
        'Ana Cliente',
        '+351911111111',
        'ana@example.test',
        [serviceId],
        null,
        startAt,
        key,
      ],
    );
    const row = result.rows[0];
    expect(row.appointment_id).toBeTruthy();
    expect(row.booking_token).toHaveLength(64);
    expect(row.lookup_code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
    expect(row.is_replay).toBe(false);

    const storedHash = await client.query(
      `select booking_lookup_code_hash from public.appointments where id = $1`,
      [row.appointment_id],
    );
    expect(storedHash.rows[0].booking_lookup_code_hash).toHaveLength(64);

    const client_ = await client.query(
      `select name, phone_e164 from public.clients where tenant_id = $1`,
      [tenantId],
    );
    expect(client_.rows).toHaveLength(1);
    expect(client_.rows[0]).toMatchObject({ name: 'Ana Cliente', phone_e164: '+351911111111' });

    const items = await client.query(
      `select source_type, source_id, unit_price_cents, duration_minutes
       from public.appointment_items where appointment_id = $1`,
      [row.appointment_id],
    );
    expect(items.rows).toEqual([
      {
        source_type: 'service',
        source_id: serviceId,
        unit_price_cents: String(servicePriceCents),
        duration_minutes: serviceMinutes,
      },
    ]);

    const appointment = await client.query(
      `select expected_total_cents, status, start_at, end_at, blocked_until
       from public.appointments where id = $1`,
      [row.appointment_id],
    );
    expect(appointment.rows[0]).toMatchObject({
      expected_total_cents: String(servicePriceCents),
      status: 'confirmed',
    });
    // end_at = start + 60min service; blocked_until = end_at + 15min buffer.
    const start = new Date(startAt).getTime();
    expect(new Date(appointment.rows[0].end_at).getTime()).toBe(start + 60 * 60_000);
    expect(new Date(appointment.rows[0].blocked_until).getTime()).toBe(start + 75 * 60_000);

    const reminder = await client.query(
      `select due_at, status from public.reminders where appointment_id = $1`,
      [row.appointment_id],
    );
    expect(reminder.rows[0].status).toBe('pending');
    expect(new Date(reminder.rows[0].due_at).getTime()).toBe(start - 24 * 60 * 60_000);
  });

  it('re-uses an existing client with the same phone instead of duplicating it', async () => {
    const startA = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
    const startB = new Date(Date.now() + 26 * 60 * 60_000).toISOString();

    await client.query(
      `select * from public.create_public_booking($1, $2, $3, $4, $5, $6, $7, $8)`,
      [tenantId, 'Ana Cliente', '+351911111111', null, [serviceId], null, startA, idempotencyKey()],
    );
    await client.query(
      `select * from public.create_public_booking($1, $2, $3, $4, $5, $6, $7, $8)`,
      [tenantId, 'Ana C.', '+351911111111', null, [serviceId], null, startB, idempotencyKey()],
    );

    const clients = await client.query(
      `select count(*)::int as count from public.clients where tenant_id = $1`,
      [tenantId],
    );
    expect(clients.rows[0].count).toBe(1);

    const appointments = await client.query(
      `select count(*)::int as count from public.appointments where tenant_id = $1`,
      [tenantId],
    );
    expect(appointments.rows[0].count).toBe(2);
  });

  it('rolls back the client upsert when the appointment insert fails (double-booked slot)', async () => {
    const startAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();

    await client.query(
      `select * from public.create_public_booking($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        tenantId,
        'First Client',
        '+351922222222',
        null,
        [serviceId],
        null,
        startAt,
        idempotencyKey(),
      ],
    );

    // Second booking, different (new) client, exact same slot — appointments_no_overlap
    // must reject it, and the whole transaction (including this second client's
    // upsert) must roll back with it.
    await expect(
      client.query(`select * from public.create_public_booking($1, $2, $3, $4, $5, $6, $7, $8)`, [
        tenantId,
        'Second Client',
        '+351933333333',
        null,
        [serviceId],
        null,
        startAt,
        idempotencyKey(),
      ]),
    ).rejects.toMatchObject({ code: '23P01' });

    const secondClient = await client.query(`select 1 from public.clients where phone_e164 = $1`, [
      '+351933333333',
    ]);
    expect(secondClient.rows).toHaveLength(0);

    const appointments = await client.query(
      `select count(*)::int as count from public.appointments where tenant_id = $1`,
      [tenantId],
    );
    expect(appointments.rows[0].count).toBe(1);
  });

  it('replays a retry with the same idempotency key and payload without creating a second appointment', async () => {
    const key = idempotencyKey();
    const startAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
    const args = [
      tenantId,
      'Ana Cliente',
      '+351911111111',
      'ana@example.test',
      [serviceId],
      null,
      startAt,
      key,
    ];

    const first = await client.query(
      `select * from public.create_public_booking($1, $2, $3, $4, $5, $6, $7, $8)`,
      args,
    );
    const second = await client.query(
      `select * from public.create_public_booking($1, $2, $3, $4, $5, $6, $7, $8)`,
      args,
    );

    expect(first.rows[0].is_replay).toBe(false);
    expect(first.rows[0].booking_token).not.toBeNull();
    expect(first.rows[0].lookup_code).not.toBeNull();
    expect(second.rows[0].is_replay).toBe(true);
    expect(second.rows[0].booking_token).toBeNull();
    expect(second.rows[0].lookup_code).toBeNull();
    expect(second.rows[0].appointment_id).toBe(first.rows[0].appointment_id);

    const appointments = await client.query(
      `select count(*)::int as count from public.appointments where tenant_id = $1`,
      [tenantId],
    );
    expect(appointments.rows[0].count).toBe(1);
  });

  it('rejects reusing the same idempotency key with a different payload', async () => {
    const key = idempotencyKey();
    const startAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();

    await client.query(
      `select * from public.create_public_booking($1, $2, $3, $4, $5, $6, $7, $8)`,
      [tenantId, 'Ana Cliente', '+351911111111', null, [serviceId], null, startAt, key],
    );

    await expect(
      client.query(`select * from public.create_public_booking($1, $2, $3, $4, $5, $6, $7, $8)`, [
        tenantId,
        'Ana Cliente',
        '+351911111111',
        null,
        [serviceId],
        null,
        new Date(Date.now() + 48 * 60 * 60_000).toISOString(),
        key,
      ]),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('under real concurrency for the same slot, exactly one of two simultaneous bookings commits', async () => {
    const startAt = new Date(Date.now() + 72 * 60 * 60_000).toISOString();
    const clientA = new Client({ connectionString });
    const clientB = new Client({ connectionString });
    await clientA.connect();
    await clientB.connect();

    try {
      const call = (conn: Client, phone: string) =>
        conn.query(`select * from public.create_public_booking($1, $2, $3, $4, $5, $6, $7, $8)`, [
          tenantId,
          'Concurrent Client',
          phone,
          null,
          [serviceId],
          null,
          startAt,
          idempotencyKey(),
        ]);

      const results = await Promise.allSettled([
        call(clientA, '+351944444444'),
        call(clientB, '+351955555555'),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ code: '23P01' });

      const appointments = await client.query(
        `select count(*)::int as count from public.appointments where tenant_id = $1 and start_at = $2`,
        [tenantId, startAt],
      );
      expect(appointments.rows[0].count).toBe(1);
    } finally {
      await clientA.end();
      await clientB.end();
    }
  });
});
