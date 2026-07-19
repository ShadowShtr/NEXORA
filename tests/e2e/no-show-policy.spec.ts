import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

// NEX-095: "Política configurável de faltas" — the owner sets a limit in Definições,
// the client fiche shows an alert once that limit is reached. This is alert-only: no
// booking is ever blocked automatically (product decision).
function bookingTokenHash(seed: string) {
  return seed.padEnd(64, '0').slice(0, 64);
}

async function seedNoShowAppointment(
  user: ProvisionedTestUser,
  tenantId: string,
  clientId: string,
  startAt: Date,
) {
  const endAt = new Date(startAt.getTime() + 60 * 60_000);
  const appointmentId = randomUUID();
  await user.admin.from('appointments').insert({
    id: appointmentId,
    tenant_id: tenantId,
    client_id: clientId,
    source: 'admin',
    status: 'no_show',
    start_at: startAt.toISOString(),
    end_at: endAt.toISOString(),
    blocked_until: new Date(endAt.getTime() + 15 * 60_000).toISOString(),
    expected_total_cents: 2500,
    booking_token_hash: bookingTokenHash(appointmentId),
  });
  return appointmentId;
}

test.describe('no-show policy (NEX-095)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.afterEach(async () => {
    if (user) await cleanupProvisionedTestUser(user);
  });

  test('owner can configure the limit in Definições', async ({ page }) => {
    user = await createProvisionedTestUser('nex095-settings');

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/dashboard/definicoes');
    await page.getByLabel('Alertar a partir de quantas faltas').selectOption('2');
    await page.getByLabel('Período considerado').selectOption('30');
    await page.getByRole('button', { name: 'Guardar política de faltas' }).click();
    await expect(page.getByText('Política guardada.')).toBeVisible();

    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    const { data: settings } = await user.admin
      .from('business_settings')
      .select('no_show_limit, no_show_window_days')
      .eq('tenant_id', tenant!.id)
      .single();
    expect(settings).toMatchObject({ no_show_limit: 2, no_show_window_days: 30 });
  });

  test('client fiche shows an alert once the configured limit is reached', async ({ page }) => {
    user = await createProvisionedTestUser('nex095-alert');
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();

    await user.admin
      .from('business_settings')
      .update({ no_show_limit: 2, no_show_window_days: 90 })
      .eq('tenant_id', tenant!.id);

    const { data: client } = await user.admin
      .from('clients')
      .insert({ tenant_id: tenant!.id, name: 'Cliente Faltosa', phone_e164: '+351911111112' })
      .select('id')
      .single();

    await seedNoShowAppointment(
      user,
      tenant!.id,
      client!.id,
      new Date(Date.now() - 5 * 24 * 60 * 60_000),
    );
    await seedNoShowAppointment(
      user,
      tenant!.id,
      client!.id,
      new Date(Date.now() - 10 * 24 * 60 * 60_000),
    );

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto(`/dashboard/clientes/${client!.id}`);
    await expect(page.getByRole('alert')).toContainText('atingindo o limite definido');
  });

  test('client fiche shows no alert when the policy is off', async ({ page }) => {
    user = await createProvisionedTestUser('nex095-off');
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();

    const { data: client } = await user.admin
      .from('clients')
      .insert({ tenant_id: tenant!.id, name: 'Cliente Sem Alerta', phone_e164: '+351911111113' })
      .select('id')
      .single();

    await seedNoShowAppointment(
      user,
      tenant!.id,
      client!.id,
      new Date(Date.now() - 5 * 24 * 60 * 60_000),
    );
    await seedNoShowAppointment(
      user,
      tenant!.id,
      client!.id,
      new Date(Date.now() - 10 * 24 * 60 * 60_000),
    );

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto(`/dashboard/clientes/${client!.id}`);
    await expect(page.getByText('Cliente Sem Alerta')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});
