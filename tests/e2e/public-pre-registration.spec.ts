import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';
import { completeRegistration, selectFirstService, selectFirstSlot } from './support/public-page';

async function publishTenantWithService(user: ProvisionedTestUser) {
  const { data: tenant } = await user.admin
    .from('tenants')
    .select('id')
    .eq('slug', user.slug)
    .single();
  await user.admin
    .from('business_settings')
    .update({ published_at: new Date().toISOString(), min_notice_hours: 1 })
    .eq('tenant_id', tenant!.id);
  await user.admin.from('tenants').update({ status: 'active' }).eq('id', tenant!.id);
  await user.admin.from('business_hours').insert(
    Array.from({ length: 7 }, (_, dayOfWeek) => ({
      tenant_id: tenant!.id,
      day_of_week: dayOfWeek,
      is_open: true,
      opens_at: '00:00',
      closes_at: '23:30',
    })),
  );

  const { data: category } = await user.admin
    .from('service_categories')
    .insert({ tenant_id: tenant!.id, name: 'Unhas', sort_order: 0, is_visible: true })
    .select('id')
    .single();
  await user.admin.from('services').insert({
    tenant_id: tenant!.id,
    category_id: category!.id,
    name: 'Manicure',
    price_cents: 1500,
    duration_minutes: 30,
    is_active: true,
  });

  return tenant!.id as string;
}

test.describe('public pre-registration step (NEX-051)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.beforeEach(async ({ page }) => {
    user = await createProvisionedTestUser('nex051');
    await publishTenantWithService(user);
    await page.goto(`/b/${user.slug}`);
    // Reach Passo 3 — the registration form only renders once a service and slot are
    // both picked, since that step now comes after them in the flow.
    await selectFirstService(page);
    await selectFirstSlot(page);
  });

  test.afterEach(async () => {
    await cleanupProvisionedTestUser(user);
  });

  test('has no automatic accessibility violations', async ({ page }) => {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  // Empty name/phone never reach the Zod schema at all — the browser's own `required`
  // attribute blocks submission first, which is the actual enforcement of "Nome/telefone
  // obrigatórios" (no server round-trip exists in this component to test against).
  test('name and phone inputs are marked required', async ({ page }) => {
    await expect(page.getByLabel('O seu nome')).toHaveAttribute('required', '');
    await expect(page.getByLabel('Telemóvel')).toHaveAttribute('required', '');
  });

  test('rejects a name shorter than 2 characters', async ({ page }) => {
    await page.getByLabel('O seu nome').fill('A');
    await page.getByLabel('Telemóvel').fill('911111111');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.locator('[role="alert"].form-error')).toContainText('nome');
  });

  test('rejects an unrecognizable phone number', async ({ page }) => {
    await page.getByLabel('O seu nome').fill('Ana Cliente');
    await page.getByLabel('Telemóvel').fill('abc');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.locator('[role="alert"].form-error')).toContainText('telemóvel');
  });

  test('rejects an invalid email when provided', async ({ page }) => {
    await page.getByLabel('O seu nome').fill('Ana Cliente');
    await page.getByLabel('Telemóvel').fill('911111111');
    await page.getByLabel('E-mail (opcional)').fill('not-an-email');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.locator('[role="alert"].form-error')).toContainText('e-mail');
  });

  test('proceeds with just name and phone, email left empty', async ({ page }) => {
    await completeRegistration(page, 'Ana Cliente', '911111111');
    await expect(page.getByText('Ana Cliente · +351911111111')).toBeVisible();
    await expect(page.getByText('Passo 4 · Confirmar')).toBeVisible();
  });

  test('"Alterar dados" returns to the registration form', async ({ page }) => {
    await completeRegistration(page, 'Ana Cliente', '911111111');
    await page.getByRole('button', { name: 'Alterar dados' }).click();
    await expect(page.getByLabel('O seu nome')).toBeVisible();
  });

  test('abandoning after registering never writes a row to clients', async ({ page }) => {
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    await completeRegistration(page, 'Ana Cliente', '911111111');
    await expect(page.getByText('Passo 4 · Confirmar')).toBeVisible();

    // "Abandon" — navigate away without ever reaching "Confirmar por WhatsApp".
    await page.goto('about:blank');

    const { data: clients, error } = await user.admin
      .from('clients')
      .select('id')
      .eq('tenant_id', tenant!.id);
    expect(error).toBeNull();
    expect(clients).toHaveLength(0);
  });
});
