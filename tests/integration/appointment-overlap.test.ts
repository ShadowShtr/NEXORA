import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

// Exercises appointments_no_overlap (supabase/migrations/0001_initial.sql), the GiST
// exclusion constraint that is the actual double-booking guard for NEX-063 — this
// constraint already existed before this task; what was missing was proof it holds
// under real concurrency, not just sequential inserts. Requires a real database: set
// TEST_DATABASE_URL to a disposable dev/CI Postgres connection string. Skips cleanly
// when unset so `npm test` stays green without one configured.
const connectionString = process.env.TEST_DATABASE_URL;

describe.runIf(Boolean(connectionString))('appointments_no_overlap (NEX-063)', () => {
  let client: Client;
  const tenantId = randomUUID();
  const tenantBId = randomUUID();
  const clientId = randomUUID();
  const clientBId = randomUUID();

  function bookingTokenHash(seed: string) {
    return seed.padEnd(64, '0').slice(0, 64);
  }

  // Every offset is relative to `now()`, computed in SQL (not bound as a JS timestamp)
  // so each test's ranges stay simple to reason about: "day 1, 00-30min" etc.
  function insertAppointment(
    conn: Client,
    id: string,
    opts: {
      tenantId: string;
      clientId: string;
      startOffset: string;
      endOffset: string;
      blockedUntilOffset: string;
      status?: string;
    },
  ) {
    return conn.query(
      `insert into public.appointments
         (id, tenant_id, client_id, source, status, start_at, end_at, blocked_until,
          expected_total_cents, booking_token_hash)
       values ($1, $2, $3, 'admin', $4,
               now() + $5::interval, now() + $6::interval, now() + $7::interval,
               2500, $8)`,
      [
        id,
        opts.tenantId,
        opts.clientId,
        opts.status ?? 'confirmed',
        opts.startOffset,
        opts.endOffset,
        opts.blockedUntilOffset,
        bookingTokenHash(id),
      ],
    );
  }

  beforeAll(async () => {
    client = new Client({ connectionString });
    await client.connect();

    for (const [id, slug] of [
      [tenantId, `nex063-${tenantId.slice(0, 8)}`],
      [tenantBId, `nex063-b-${tenantBId.slice(0, 8)}`],
    ]) {
      await client.query(
        `insert into public.tenants (id, slug, name, status) values ($1, $2, 'Test Tenant', 'setup')`,
        [id, slug],
      );
    }

    await client.query(
      `insert into public.clients (id, tenant_id, name, phone_e164) values ($1, $2, 'Client A', '+351910000002')`,
      [clientId, tenantId],
    );
    await client.query(
      `insert into public.clients (id, tenant_id, name, phone_e164) values ($1, $2, 'Client B', '+351910000003')`,
      [clientBId, tenantBId],
    );
  });

  afterEach(async () => {
    await client.query(`delete from public.appointments where tenant_id in ($1, $2)`, [
      tenantId,
      tenantBId,
    ]);
  });

  afterAll(async () => {
    await client.query(`delete from public.tenants where id = any($1::uuid[])`, [
      [tenantId, tenantBId],
    ]);
    await client.end();
  });

  it('rejects an insert overlapping an existing confirmed appointment (same tenant)', async () => {
    const first = randomUUID();
    const second = randomUUID();
    await insertAppointment(client, first, {
      tenantId,
      clientId,
      startOffset: '1 day',
      endOffset: '1 day 30 minutes',
      blockedUntilOffset: '1 day 45 minutes',
    });

    await expect(
      insertAppointment(client, second, {
        tenantId,
        clientId,
        startOffset: '1 day 15 minutes',
        endOffset: '1 day 45 minutes',
        blockedUntilOffset: '1 day 60 minutes',
      }),
    ).rejects.toMatchObject({ code: '23P01' });
  });

  it('allows back-to-back appointments that only touch at the boundary (half-open range)', async () => {
    const first = randomUUID();
    const second = randomUUID();
    await insertAppointment(client, first, {
      tenantId,
      clientId,
      startOffset: '1 day',
      endOffset: '1 day 30 minutes',
      blockedUntilOffset: '1 day 45 minutes',
    });

    // Second appointment starts exactly when the first's blocked_until ends — the range
    // is `[start_at, blocked_until)`, half-open, so this must NOT be treated as overlap.
    await expect(
      insertAppointment(client, second, {
        tenantId,
        clientId,
        startOffset: '1 day 45 minutes',
        endOffset: '1 day 75 minutes',
        blockedUntilOffset: '1 day 90 minutes',
      }),
    ).resolves.toMatchObject({ rowCount: 1 });
  });

  it('does not block an overlapping appointment on a different tenant', async () => {
    const first = randomUUID();
    const second = randomUUID();
    await insertAppointment(client, first, {
      tenantId,
      clientId,
      startOffset: '1 day',
      endOffset: '1 day 30 minutes',
      blockedUntilOffset: '1 day 45 minutes',
    });

    await expect(
      insertAppointment(client, second, {
        tenantId: tenantBId,
        clientId: clientBId,
        startOffset: '1 day 15 minutes',
        endOffset: '1 day 45 minutes',
        blockedUntilOffset: '1 day 60 minutes',
      }),
    ).resolves.toMatchObject({ rowCount: 1 });
  });

  it('does not block an overlapping appointment once the earlier one is cancelled', async () => {
    const first = randomUUID();
    const second = randomUUID();
    await insertAppointment(client, first, {
      tenantId,
      clientId,
      startOffset: '1 day',
      endOffset: '1 day 30 minutes',
      blockedUntilOffset: '1 day 45 minutes',
    });

    await client.query(`update public.appointments set status = 'cancelled' where id = $1`, [
      first,
    ]);

    await expect(
      insertAppointment(client, second, {
        tenantId,
        clientId,
        startOffset: '1 day 15 minutes',
        endOffset: '1 day 45 minutes',
        blockedUntilOffset: '1 day 60 minutes',
      }),
    ).resolves.toMatchObject({ rowCount: 1 });
  });

  it('under real concurrency, exactly one of two simultaneous overlapping inserts commits', async () => {
    const first = randomUUID();
    const second = randomUUID();
    const clientA = new Client({ connectionString });
    const clientB = new Client({ connectionString });
    await clientA.connect();
    await clientB.connect();

    try {
      // Two independent connections, each in its own transaction, racing to insert the
      // exact same time range for the same tenant — this is what a real double-click or
      // two visitors hitting the public booking page at once looks like. The exclusion
      // constraint (not application code) must be what decides the winner.
      await clientA.query('begin');
      await clientB.query('begin');

      const results = await Promise.allSettled([
        insertAppointment(clientA, first, {
          tenantId,
          clientId,
          startOffset: '2 days',
          endOffset: '2 days 30 minutes',
          blockedUntilOffset: '2 days 45 minutes',
        }).then(() => clientA.query('commit')),
        insertAppointment(clientB, second, {
          tenantId,
          clientId,
          startOffset: '2 days',
          endOffset: '2 days 30 minutes',
          blockedUntilOffset: '2 days 45 minutes',
        }).then(() => clientB.query('commit')),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ code: '23P01' });

      const count = await client.query(
        `select count(*)::int as count from public.appointments where tenant_id = $1 and status = 'confirmed'`,
        [tenantId],
      );
      expect(count.rows[0].count).toBe(1);
    } finally {
      await clientA.query('rollback').catch(() => undefined);
      await clientB.query('rollback').catch(() => undefined);
      await clientA.end();
      await clientB.end();
    }
  });
});
