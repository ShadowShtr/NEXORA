import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

// NEX-081 acceptance criteria: "Axe/mobile" — the appointment card (horário, cliente,
// itens, valor, estado, duas ações rápidas) rendered on /dashboard/agenda must be
// accessible and must not force horizontal overflow on a narrow viewport.
function bookingTokenHash(seed: string) {
  return seed.padEnd(64, '0').slice(0, 64);
}

async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

async function seedTodayAppointment(user: ProvisionedTestUser, tenantId: string) {
  const { data: client } = await user.admin
    .from('clients')
    .insert({ tenant_id: tenantId, name: 'Ana Cliente', phone_e164: '+351911111111' })
    .select('id')
    .single();

  const startAt = new Date(Date.now() + 60 * 60_000);
  const endAt = new Date(startAt.getTime() + 60 * 60_000);
  const appointmentId = randomUUID();

  await user.admin.from('appointments').insert({
    id: appointmentId,
    tenant_id: tenantId,
    client_id: client!.id,
    source: 'admin',
    status: 'confirmed',
    start_at: startAt.toISOString(),
    end_at: endAt.toISOString(),
    blocked_until: new Date(endAt.getTime() + 15 * 60_000).toISOString(),
    expected_total_cents: 2500,
    booking_token_hash: bookingTokenHash(appointmentId),
  });

  await user.admin.from('appointment_items').insert({
    tenant_id: tenantId,
    appointment_id: appointmentId,
    source_type: 'manual_extra',
    description: 'Verniz Gel',
    unit_price_cents: 2500,
    duration_minutes: 60,
  });
}

test.describe('appointment card (NEX-081)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.beforeEach(async ({ page }) => {
    user = await createProvisionedTestUser('nex081');
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    await seedTodayAppointment(user, tenant!.id);

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/dashboard/agenda');
  });

  test.afterEach(async () => {
    await cleanupProvisionedTestUser(user);
  });

  test('shows time, client, items, total, status and both quick actions', async ({ page }) => {
    const card = page.locator('.appointment-card').first();
    await expect(card).toBeVisible();
    await expect(card.getByText('Ana Cliente')).toBeVisible();
    await expect(card.getByText('Verniz Gel')).toBeVisible();
    await expect(card.getByText('25,00 €')).toBeVisible();
    await expect(card.getByText('Confirmada')).toBeVisible();

    await expect(card.getByRole('link', { name: 'Abrir WhatsApp' })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Concluir' })).toBeVisible();
  });

  test('the "Abrir WhatsApp" link points to a wa.me deep link for the client', async ({ page }) => {
    const card = page.locator('.appointment-card').first();
    const href = await card.getByRole('link', { name: 'Abrir WhatsApp' }).getAttribute('href');
    expect(href).toContain('https://wa.me/351911111111');
    expect(href).toContain('text=');
  });

  test('has no automatic accessibility violations', async ({ page }) => {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('no horizontal overflow on a narrow viewport', async ({ page }) => {
    await expectNoHorizontalOverflow(page);
  });
});
