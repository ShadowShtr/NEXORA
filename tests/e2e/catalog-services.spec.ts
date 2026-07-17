import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

async function createCategory(page: Page, name: string) {
  await page.getByRole('textbox', { name: 'Nova categoria' }).fill(name);
  await page.getByRole('button', { name: 'Criar categoria' }).click();
  await expect(page.getByLabel(`Nome da categoria ${name}`)).toBeVisible();
}

// Row forms and the "Novo serviço" create form share field names/labels — scope every
// locator to one or the other explicitly instead of guessing DOM order or index.
function createServiceForm(page: Page) {
  return page.locator('form[aria-label="Novo serviço"]');
}

async function createService(
  page: Page,
  {
    name,
    priceEuros,
    durationMinutes,
  }: { name: string; priceEuros: string; durationMinutes?: string },
) {
  const form = createServiceForm(page);
  await form.locator('input[name="name"]').fill(name);
  await form.locator('input[name="priceEuros"]').fill(priceEuros);
  if (durationMinutes) await form.locator('input[name="durationMinutes"]').fill(durationMinutes);
  await form.getByRole('button', { name: 'Criar serviço' }).click();
}

test.describe('catalog services CRUD (NEX-041)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.beforeEach(async ({ page }) => {
    user = await createProvisionedTestUser('nex041');
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/dashboard/servicos');
  });

  test.afterEach(async () => {
    await cleanupProvisionedTestUser(user);
  });

  test('has no automatic accessibility violations', async ({ page }) => {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('shows a helper message instead of the service form until a category exists', async ({
    page,
  }) => {
    await expect(page.getByText('Crie primeiro uma categoria')).toBeVisible();
  });

  test('creates a service, storing the price as integer cents', async ({ page }) => {
    await createCategory(page, 'Manicure');
    await createService(page, { name: 'Verniz gel', priceEuros: '25,50', durationMinutes: '45' });

    const row = page.locator('section[aria-label="Serviços"] .catalog-row').first();
    await expect(row.locator('input[name="name"]')).toHaveValue('Verniz gel');

    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    const { data: services } = await user.admin
      .from('services')
      .select('name, price_cents, duration_minutes, is_active')
      .eq('tenant_id', tenant!.id);
    expect(services).toMatchObject([
      { name: 'Verniz gel', price_cents: 2550, duration_minutes: 45, is_active: true },
    ]);
  });

  test('rejects a duplicate service name with a friendly error', async ({ page }) => {
    await createCategory(page, 'Manicure');
    await createService(page, { name: 'Verniz gel', priceEuros: '25,00' });
    await expect(
      page
        .locator('section[aria-label="Serviços"] .catalog-row')
        .first()
        .locator('input[name="name"]'),
    ).toHaveValue('Verniz gel');

    await createService(page, { name: 'Verniz gel', priceEuros: '30,00' });
    await expect(createServiceForm(page).locator('[role="alert"].form-error')).toContainText(
      'Já existe',
    );
    // Still only the one row — the duplicate attempt was rejected, not persisted.
    await expect(page.locator('section[aria-label="Serviços"] .catalog-row')).toHaveCount(1);
  });

  test('edits a service (name, price, duration, category)', async ({ page }) => {
    await createCategory(page, 'Manicure');
    await createCategory(page, 'Pedicure');
    await createService(page, { name: 'Verniz gel', priceEuros: '25,00' });

    const row = page.locator('section[aria-label="Serviços"] .catalog-row').first();
    await expect(row.locator('input[name="name"]')).toHaveValue('Verniz gel');

    await row.locator('input[name="name"]').fill('Verniz gel premium');
    await row.locator('input[name="priceEuros"]').fill('35,00');
    await row.locator('select[name="categoryId"]').selectOption({ label: 'Pedicure' });
    await row.getByRole('button', { name: 'Guardar' }).click();
    await expect(row.locator('input[name="name"]')).toHaveValue('Verniz gel premium');

    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    const { data: services } = await user.admin
      .from('services')
      .select('name, price_cents')
      .eq('tenant_id', tenant!.id);
    expect(services).toMatchObject([{ name: 'Verniz gel premium', price_cents: 3500 }]);
  });

  test('activates and deactivates a service', async ({ page }) => {
    await createCategory(page, 'Manicure');
    await createService(page, { name: 'Verniz gel', priceEuros: '25,00' });

    const row = page.locator('section[aria-label="Serviços"] .catalog-row').first();
    await expect(row.locator('input[name="name"]')).toHaveValue('Verniz gel');

    await row.getByRole('button', { name: 'Desativar' }).click();
    await expect(page.getByText('Inativo — não é oferecido')).toBeVisible();

    await row.getByRole('button', { name: 'Ativar' }).click();
    await expect(page.getByText('Inativo — não é oferecido')).toHaveCount(0);
  });
});
