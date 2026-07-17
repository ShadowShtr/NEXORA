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

function createServiceForm(page: Page) {
  return page.locator('form[aria-label="Novo serviço"]');
}

function createPackageForm(page: Page) {
  return page.locator('form[aria-label="Novo pacote"]');
}

function packagesRegion(page: Page) {
  return page.locator('section[aria-label="Pacotes"]');
}

test.describe('catalog packages CRUD (NEX-042)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.beforeEach(async ({ page }) => {
    user = await createProvisionedTestUser('nex042');
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

  test('shows a helper message instead of the package form until a service exists', async ({
    page,
  }) => {
    await expect(page.getByText('Crie primeiro um serviço')).toBeVisible();
  });

  test('creates a package with two services, deriving the summed duration', async ({ page }) => {
    await createCategory(page, 'Manicure');
    const servicesForm = createServiceForm(page);
    await servicesForm.locator('input[name="name"]').fill('Verniz gel');
    await servicesForm.locator('input[name="priceEuros"]').fill('25,00');
    await servicesForm.locator('input[name="durationMinutes"]').fill('60');
    await servicesForm.getByRole('button', { name: 'Criar serviço' }).click();
    await expect(
      page
        .locator('section[aria-label="Serviços"] .catalog-row')
        .first()
        .locator('input[name="name"]'),
    ).toHaveValue('Verniz gel');

    await servicesForm.locator('input[name="name"]').fill('Pedicure spa');
    await servicesForm.locator('input[name="priceEuros"]').fill('30,00');
    await servicesForm.locator('input[name="durationMinutes"]').fill('45');
    await servicesForm.getByRole('button', { name: 'Criar serviço' }).click();
    // Services list is ordered by created_at ascending — the newest is last.
    await expect(
      page
        .locator('section[aria-label="Serviços"] .catalog-row')
        .last()
        .locator('input[name="name"]'),
    ).toHaveValue('Pedicure spa');

    const packageForm = createPackageForm(page);
    await packageForm.locator('input[name="name"]').fill('Mãos e pés');
    await packageForm.locator('input[name="priceEuros"]').fill('45,00');
    await packageForm.getByLabel('Verniz gel · 60 min').check();
    await packageForm.getByLabel('Pedicure spa · 45 min').check();
    await packageForm.getByRole('button', { name: 'Criar pacote' }).click();

    const packageRow = packagesRegion(page).locator('.catalog-row').first();
    await expect(packageRow.locator('input[name="name"]')).toHaveValue('Mãos e pés');
    await expect(packageRow).toContainText('45,00');
    await expect(packageRow).toContainText('105 min');

    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    const { data: pkg } = await user.admin
      .from('packages')
      .select('id, price_cents')
      .eq('tenant_id', tenant!.id)
      .single();
    expect(pkg?.price_cents).toBe(4500);
    const { data: items } = await user.admin
      .from('package_services')
      .select('service_id')
      .eq('package_id', pkg!.id);
    expect(items).toHaveLength(2);
  });

  test('rejects a duplicate package name with a friendly error', async ({ page }) => {
    await createCategory(page, 'Manicure');
    const servicesForm = createServiceForm(page);
    await servicesForm.locator('input[name="name"]').fill('Verniz gel');
    await servicesForm.locator('input[name="priceEuros"]').fill('25,00');
    await servicesForm.locator('input[name="durationMinutes"]').fill('60');
    await servicesForm.getByRole('button', { name: 'Criar serviço' }).click();
    await expect(
      page
        .locator('section[aria-label="Serviços"] .catalog-row')
        .first()
        .locator('input[name="name"]'),
    ).toHaveValue('Verniz gel');

    const packageForm = createPackageForm(page);
    await packageForm.locator('input[name="name"]').fill('Combo');
    await packageForm.locator('input[name="priceEuros"]').fill('20,00');
    await packageForm.getByLabel('Verniz gel · 60 min').check();
    await packageForm.getByRole('button', { name: 'Criar pacote' }).click();
    await expect(packagesRegion(page).locator('.catalog-row')).toHaveCount(1);

    await packageForm.locator('input[name="name"]').fill('Combo');
    await packageForm.locator('input[name="priceEuros"]').fill('22,00');
    await packageForm.getByLabel('Verniz gel · 60 min').check();
    await packageForm.getByRole('button', { name: 'Criar pacote' }).click();
    await expect(packageForm.locator('[role="alert"].form-error')).toContainText('Já existe');
    await expect(packagesRegion(page).locator('.catalog-row')).toHaveCount(1);
  });

  test('activates and deactivates a package', async ({ page }) => {
    await createCategory(page, 'Manicure');
    const servicesForm = createServiceForm(page);
    await servicesForm.locator('input[name="name"]').fill('Verniz gel');
    await servicesForm.locator('input[name="priceEuros"]').fill('25,00');
    await servicesForm.locator('input[name="durationMinutes"]').fill('60');
    await servicesForm.getByRole('button', { name: 'Criar serviço' }).click();
    await expect(
      page
        .locator('section[aria-label="Serviços"] .catalog-row')
        .first()
        .locator('input[name="name"]'),
    ).toHaveValue('Verniz gel');

    const packageForm = createPackageForm(page);
    await packageForm.locator('input[name="name"]').fill('Combo');
    await packageForm.locator('input[name="priceEuros"]').fill('20,00');
    await packageForm.getByLabel('Verniz gel · 60 min').check();
    await packageForm.getByRole('button', { name: 'Criar pacote' }).click();

    const packageRow = packagesRegion(page).locator('.catalog-row').first();
    await expect(packageRow.locator('input[name="name"]')).toHaveValue('Combo');

    await packageRow.getByRole('button', { name: 'Desativar' }).click();
    await expect(packageRow.getByText('Inativo — não é oferecido')).toBeVisible();

    await packageRow.getByRole('button', { name: 'Ativar' }).click();
    await expect(packageRow.getByText('Inativo — não é oferecido')).toHaveCount(0);
  });
});
