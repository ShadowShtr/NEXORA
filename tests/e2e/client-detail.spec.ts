import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

// NEX-091 acceptance criteria: "Privacidade e acesso" — the client detail page (resumo,
// histórico, preferências, faltas, valores) must never be reachable for a client
// belonging to a different tenant, even by guessing the id directly.
function bookingTokenHash(seed: string) {
  return seed.padEnd(64, '0').slice(0, 64);
}

test.describe('client detail page (NEX-091)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;
  let otherTenant: ProvisionedTestUser;

  test.afterEach(async () => {
    if (user) await cleanupProvisionedTestUser(user);
    if (otherTenant) await cleanupProvisionedTestUser(otherTenant);
  });

  test('shows summary, history and lets the owner save preferences for their own client', async ({
    page,
  }) => {
    user = await createProvisionedTestUser('nex091');
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();

    const { data: client } = await user.admin
      .from('clients')
      .insert({ tenant_id: tenant!.id, name: 'Ana Cliente', phone_e164: '+351911111111' })
      .select('id')
      .single();

    const startAt = new Date(Date.now() - 24 * 60 * 60_000);
    const endAt = new Date(startAt.getTime() + 60 * 60_000);
    const appointmentId = randomUUID();
    await user.admin.from('appointments').insert({
      id: appointmentId,
      tenant_id: tenant!.id,
      client_id: client!.id,
      source: 'admin',
      status: 'completed',
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      blocked_until: new Date(endAt.getTime() + 15 * 60_000).toISOString(),
      expected_total_cents: 3000,
      final_total_cents: 3000,
      booking_token_hash: bookingTokenHash(appointmentId),
    });
    await user.admin.from('appointment_items').insert({
      tenant_id: tenant!.id,
      appointment_id: appointmentId,
      source_type: 'manual_extra',
      description: 'Verniz Gel',
      unit_price_cents: 3000,
      duration_minutes: 60,
    });

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto(`/dashboard/clientes/${client!.id}`);
    await expect(page.getByRole('heading', { name: 'Ana Cliente' })).toBeVisible();
    await expect(page.getByText('+351911111111')).toBeVisible();
    await expect(page.getByText('Verniz Gel')).toBeVisible();
    await expect(page.getByText('30,00 €').first()).toBeVisible();

    await page.getByLabel('Cores preferidas').fill('Vermelho');
    await page.getByRole('button', { name: 'Guardar preferências' }).click();
    await expect(page.getByText('Preferências guardadas.')).toBeVisible();

    const { data: reloaded } = await user.admin
      .from('clients')
      .select('preferences')
      .eq('id', client!.id)
      .single();
    expect(reloaded?.preferences).toMatchObject({ colors: 'Vermelho' });
  });

  test('returns 404 for a client id that belongs to a different tenant', async ({ page }) => {
    user = await createProvisionedTestUser('nex091-owner');
    otherTenant = await createProvisionedTestUser('nex091-other');

    const { data: otherTenantRow } = await otherTenant.admin
      .from('tenants')
      .select('id')
      .eq('slug', otherTenant.slug)
      .single();
    const { data: otherClient } = await otherTenant.admin
      .from('clients')
      .insert({
        tenant_id: otherTenantRow!.id,
        name: 'Cliente De Outro Tenant',
        phone_e164: '+351922222222',
      })
      .select('id')
      .single();

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    const response = await page.goto(`/dashboard/clientes/${otherClient!.id}`);
    expect(response?.status()).toBe(404);
    await expect(page.getByText('Cliente De Outro Tenant')).toHaveCount(0);
  });
});
