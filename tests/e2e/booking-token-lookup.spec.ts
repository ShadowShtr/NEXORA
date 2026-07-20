import { randomBytes, createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

// NEX-071: GET /api/bookings/{token} (src/app/api/bookings/[token]/route.ts). The
// acceptance criteria calls for "respostas uniformes" against enumeration
// (docs/05_SECURITY_PRIVACY.md, T3) — a malformed token, a well-formed-but-unknown
// token, and a token belonging to a real appointment on another tenant must all be
// indistinguishable from the outside (identical 404 status + body shape).
function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function randomToken() {
  return randomBytes(32).toString('hex');
}

test.describe('booking token lookup (NEX-071)', () => {
  let user: ProvisionedTestUser;
  let appointmentId: string;
  const realToken = randomToken();

  test.beforeAll(async () => {
    test.skip(!canUseSupabase(), 'Requires Supabase credentials');
    user = await createProvisionedTestUser('nex071');

    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    await user.admin
      .from('business_settings')
      .update({ address_line: 'Rua Teste 1', postal_code: '1000-000', locality: 'Lisboa' })
      .eq('tenant_id', tenant!.id);

    const { data: client } = await user.admin
      .from('clients')
      .insert({
        tenant_id: tenant!.id,
        name: 'Cliente Confidencial',
        phone_e164: '+351911111111',
      })
      .select('id')
      .single();

    const { data: appointment } = await user.admin
      .from('appointments')
      .insert({
        tenant_id: tenant!.id,
        client_id: client!.id,
        source: 'public',
        status: 'confirmed',
        start_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
        end_at: new Date(Date.now() + 25 * 60 * 60_000).toISOString(),
        blocked_until: new Date(Date.now() + 25 * 60 * 60_000 + 15 * 60_000).toISOString(),
        expected_total_cents: 2500,
        booking_token_hash: hashToken(realToken),
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

  test('returns the minimal public view for a valid token, without client PII', async ({
    request,
  }) => {
    const response = await request.get(`/api/bookings/${realToken}`);
    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(body.data.status).toBe('confirmed');
    expect(body.data.totalCents).toBe(2500);
    expect(body.data.items).toEqual([
      { description: 'Verniz Gel', unitPriceCents: 2500, quantity: 1 },
    ]);
    expect(body.data.business.addressLine).toBe('Rua Teste 1');

    // Never leaks the client's own contact details.
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('Cliente Confidencial');
    expect(serialized).not.toContain('+351911111111');
  });

  test('a malformed token, an unknown well-formed token, and a real token belonging to no accessible record all return the identical 404 shape', async ({
    request,
  }) => {
    const malformed = await request.get('/api/bookings/not-a-valid-token');
    const unknown = await request.get(`/api/bookings/${randomToken()}`);

    expect(malformed.status()).toBe(404);
    expect(unknown.status()).toBe(404);

    const malformedBody = await malformed.json();
    const unknownBody = await unknown.json();
    expect(malformedBody).toEqual(unknownBody);
    expect(malformedBody).toEqual({
      error: { code: 'NOT_FOUND', message: 'Marcação não encontrada.' },
    });
  });

  test('the response is never cached by an intermediary', async ({ request }) => {
    const response = await request.get(`/api/bookings/${realToken}`);
    expect(response.headers()['cache-control']).toBe('no-store');
  });
});
