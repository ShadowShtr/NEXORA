import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

test.describe('catalog categories CRUD (NEX-040)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.beforeEach(async ({ page }) => {
    user = await createProvisionedTestUser('nex040');
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

  test('creates a category', async ({ page }) => {
    await page.getByRole('textbox', { name: 'Nova categoria' }).fill('Manicure');
    await page.getByRole('button', { name: 'Criar categoria' }).click();
    await expect(page.getByLabel('Nome da categoria Manicure')).toBeVisible();

    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    const { data: categories } = await user.admin
      .from('service_categories')
      .select('name')
      .eq('tenant_id', tenant!.id);
    expect(categories).toMatchObject([{ name: 'Manicure' }]);
  });

  test('rejects a duplicate category name with a friendly error', async ({ page }) => {
    await page.getByRole('textbox', { name: 'Nova categoria' }).fill('Manicure');
    await page.getByRole('button', { name: 'Criar categoria' }).click();
    await expect(page.getByLabel('Nome da categoria Manicure')).toBeVisible();

    await page.getByRole('textbox', { name: 'Nova categoria' }).fill('Manicure');
    await page.getByRole('button', { name: 'Criar categoria' }).click();
    await expect(page.locator('[role="alert"].form-error')).toContainText('Já existe');
  });

  test('renames a category', async ({ page }) => {
    await page.getByRole('textbox', { name: 'Nova categoria' }).fill('Manicure');
    await page.getByRole('button', { name: 'Criar categoria' }).click();
    const nameInput = page.getByLabel('Nome da categoria Manicure');
    await expect(nameInput).toBeVisible();

    await nameInput.fill('Manicure Premium');
    await page
      .locator('.catalog-row-name', { has: nameInput })
      .getByRole('button', { name: 'Guardar' })
      .click();
    await expect(page.getByLabel('Nome da categoria Manicure Premium')).toBeVisible();
  });

  test('hides and shows a category', async ({ page }) => {
    await page.getByRole('textbox', { name: 'Nova categoria' }).fill('Manicure');
    await page.getByRole('button', { name: 'Criar categoria' }).click();
    await expect(page.getByLabel('Nome da categoria Manicure')).toBeVisible();

    await page.getByRole('button', { name: 'Ocultar' }).click();
    await expect(page.getByText('Oculta da cliente')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mostrar' })).toBeVisible();

    await page.getByRole('button', { name: 'Mostrar' }).click();
    await expect(page.getByText('Oculta da cliente')).toHaveCount(0);
  });

  test('reorders categories with the up/down buttons', async ({ page }) => {
    await page.getByRole('textbox', { name: 'Nova categoria' }).fill('Manicure');
    await page.getByRole('button', { name: 'Criar categoria' }).click();
    await expect(page.getByLabel('Nome da categoria Manicure')).toBeVisible();

    await page.getByRole('textbox', { name: 'Nova categoria' }).fill('Pedicure');
    await page.getByRole('button', { name: 'Criar categoria' }).click();
    await expect(page.getByLabel('Nome da categoria Pedicure')).toBeVisible();

    // Manicure was created first, so it starts above Pedicure. Names live inside
    // <input value>, not text nodes, so check the name field's value, not innerText.
    const rows = page.locator('.catalog-row');
    const nameInput = (row: Locator) => row.locator('input[name="name"]');
    await expect(nameInput(rows.nth(0))).toHaveValue('Manicure');
    await expect(nameInput(rows.nth(1))).toHaveValue('Pedicure');

    await rows.nth(1).getByRole('button', { name: 'Mover para cima' }).click();
    await expect(nameInput(rows.nth(0))).toHaveValue('Pedicure');
    await expect(nameInput(rows.nth(1))).toHaveValue('Manicure');
  });
});
