import { randomBytes, createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

// NEX-072: GET /api/bookings/{token}/calendar.ics
// (src/app/api/bookings/[token]/calendar.ics/route.ts). RFC 5545 structural conformance
// (folding, escaping, CRLF, UTC timestamps) is covered exhaustively in
// tests/unit/ics.test.ts — this file proves the HTTP contract a real calendar client
// depends on to *recognize and import* the file: correct Content-Type, an attachment
// disposition with a .ics filename, and a body that is exactly what generateIcsEvent
// would produce for this appointment's real data (timezone via UTC DTSTART/DTEND,
// duration derived from start/end, address as LOCATION, a stable UID).
function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function randomToken() {
  return randomBytes(32).toString('hex');
}

test.describe('booking calendar.ics (NEX-072)', () => {
  let user: ProvisionedTestUser;
  let appointmentId: string;
  const token = randomToken();
  const startAt = new Date(Date.now() + 24 * 60 * 60_000);
  const endAt = new Date(startAt.getTime() + 60 * 60_000);

  test.beforeAll(async () => {
    test.skip(!canUseSupabase(), 'Requires Supabase credentials');
    user = await createProvisionedTestUser('nex072');

    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    await user.admin
      .from('business_settings')
      .update({
        professional_name: 'Joana Nails',
        address_line: 'Rua Teste 1',
        postal_code: '1000-000',
        locality: 'Lisboa',
      })
      .eq('tenant_id', tenant!.id);

    const { data: client } = await user.admin
      .from('clients')
      .insert({ tenant_id: tenant!.id, name: 'Cliente ICS', phone_e164: '+351912222222' })
      .select('id')
      .single();

    const { data: appointment } = await user.admin
      .from('appointments')
      .insert({
        tenant_id: tenant!.id,
        client_id: client!.id,
        source: 'public',
        status: 'confirmed',
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        blocked_until: new Date(endAt.getTime() + 15 * 60_000).toISOString(),
        expected_total_cents: 2500,
        booking_token_hash: hashToken(token),
      })
      .select('id')
      .single();
    appointmentId = appointment!.id;

    await user.admin.from('appointment_items').insert({
      tenant_id: tenant!.id,
      appointment_id: appointmentId,
      source_type: 'manual_extra',
      description: 'Verniz Gel',
      unit_price_cents: 2500,
      duration_minutes: 60,
    });
  });

  test.afterAll(async () => {
    if (user) await cleanupProvisionedTestUser(user);
  });

  test('serves a downloadable, well-formed .ics with the correct duration, address and a stable UID', async ({
    request,
  }) => {
    const response = await request.get(`/api/bookings/${token}/calendar.ics`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/calendar');
    expect(response.headers()['content-disposition']).toContain('attachment');
    expect(response.headers()['content-disposition']).toContain('.ics');

    const body = await response.text();
    expect(body).toContain('BEGIN:VCALENDAR\r\n');
    expect(body).toContain('END:VCALENDAR\r\n');
    expect(body).toContain(`UID:${appointmentId}@nexora\r\n`);
    expect(body).toContain('LOCATION:Rua Teste 1\\, 1000-000 Lisboa\r\n');
    expect(body).toContain('SUMMARY:Marcação — Joana Nails\r\n');

    // Duration: end minus start must match what was booked (1h), expressed as UTC
    // instants regardless of Europe/Lisbon's own DST state on the given date.
    const dtstartMatch = body.match(/DTSTART:(\d{8}T\d{6}Z)/);
    const dtendMatch = body.match(/DTEND:(\d{8}T\d{6}Z)/);
    expect(dtstartMatch).not.toBeNull();
    expect(dtendMatch).not.toBeNull();
    const parseIcsUtc = (value: string) =>
      Date.UTC(
        Number(value.slice(0, 4)),
        Number(value.slice(4, 6)) - 1,
        Number(value.slice(6, 8)),
        Number(value.slice(9, 11)),
        Number(value.slice(11, 13)),
        Number(value.slice(13, 15)),
      );
    const durationMs = parseIcsUtc(dtendMatch![1]!) - parseIcsUtc(dtstartMatch![1]!);
    expect(durationMs).toBe(60 * 60_000);
  });

  test('re-downloading the same token yields the identical UID (stable across re-imports)', async ({
    request,
  }) => {
    const first = await (await request.get(`/api/bookings/${token}/calendar.ics`)).text();
    const second = await (await request.get(`/api/bookings/${token}/calendar.ics`)).text();

    const extractUid = (ics: string) => ics.match(/UID:(.+)\r\n/)?.[1];
    expect(extractUid(first)).toBe(extractUid(second));
  });

  test('an unknown token gets the same 404 JSON shape as the booking lookup route', async ({
    request,
  }) => {
    const response = await request.get(`/api/bookings/${randomToken()}/calendar.ics`);
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'Marcação não encontrada.' },
    });
  });
});
