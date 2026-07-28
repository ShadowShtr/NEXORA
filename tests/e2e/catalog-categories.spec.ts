import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

function categorySheet(page: Page) {
  return page.getByRole('dialog', { name: 'Gerir categorias' });
}

// The category name is a click-to-edit button when not being renamed
// (.category-management-name, CategoryRow) — its "Nome da categoria X" aria-label
// only exists on the swapped-in rename <input>, not on this display state.
function categoryButton(sheet: Locator, name: string): Locator {
  return sheet.getByRole('button', { name, exact: true });
}

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
    // Categories now manage themselves in a dedicated sheet (CategoryManagementSheet)
    // rather than inline in the main list — "Gerir" (header, via CategoryChips) is
    // always present regardless of whether any category exists yet. A fresh tenant
    // *also* shows a "Gerir categorias" empty-state button with the same effect —
    // exact:true keeps this from matching that one too (substring match otherwise
    // would, since "Gerir categorias" contains "Gerir").
    await page.getByRole('button', { name: 'Gerir', exact: true }).click();
  });

  test.afterEach(async () => {
    await cleanupProvisionedTestUser(user);
  });

  test('has no automatic accessibility violations', async ({ page }) => {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('creates a category', async ({ page }) => {
    const sheet = categorySheet(page);
    await sheet.getByRole('textbox', { name: 'Nova categoria' }).fill('Manicure');
    await sheet.getByRole('button', { name: 'Criar categoria' }).click();
    await expect(categoryButton(sheet, 'Manicure')).toBeVisible();

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
    const sheet = categorySheet(page);
    await sheet.getByRole('textbox', { name: 'Nova categoria' }).fill('Manicure');
    await sheet.getByRole('button', { name: 'Criar categoria' }).click();
    await expect(categoryButton(sheet, 'Manicure')).toBeVisible();

    await sheet.getByRole('textbox', { name: 'Nova categoria' }).fill('Manicure');
    await sheet.getByRole('button', { name: 'Criar categoria' }).click();
    await expect(sheet.locator('[role="alert"].form-error')).toContainText('Já existe');
  });

  test('renames a category', async ({ page }) => {
    const sheet = categorySheet(page);
    await sheet.getByRole('textbox', { name: 'Nova categoria' }).fill('Manicure');
    await sheet.getByRole('button', { name: 'Criar categoria' }).click();
    await expect(categoryButton(sheet, 'Manicure')).toBeVisible();

    // Clicking the name swaps in an editable input, which self-submits on blur/Enter
    // (CategoryManagementSheet.tsx) — that input is the one thing that actually
    // carries the "Nome da categoria X" aria-label.
    await categoryButton(sheet, 'Manicure').click();
    const nameInput = page.getByLabel('Nome da categoria Manicure');
    await nameInput.fill('Manicure Premium');
    await nameInput.press('Enter');
    await expect(categoryButton(sheet, 'Manicure Premium')).toBeVisible();
  });

  test('hides and shows a category', async ({ page }) => {
    const sheet = categorySheet(page);
    await sheet.getByRole('textbox', { name: 'Nova categoria' }).fill('Manicure');
    await sheet.getByRole('button', { name: 'Criar categoria' }).click();
    await expect(categoryButton(sheet, 'Manicure')).toBeVisible();

    // role="switch" (CategoryRow's visibility toggle) overrides the element's native
    // <button> role for accessibility purposes — it's exposed as "switch", not
    // "button".
    await sheet.getByRole('switch', { name: 'Ocultar categoria' }).click();
    await expect(sheet.getByText('Oculta', { exact: true })).toBeVisible();
    await expect(sheet.getByRole('switch', { name: 'Mostrar categoria' })).toBeVisible();

    await sheet.getByRole('switch', { name: 'Mostrar categoria' }).click();
    await expect(sheet.getByText('Oculta', { exact: true })).toHaveCount(0);
  });

  test('reorders categories with the up/down buttons', async ({ page }) => {
    const sheet = categorySheet(page);
    await sheet.getByRole('textbox', { name: 'Nova categoria' }).fill('Manicure');
    await sheet.getByRole('button', { name: 'Criar categoria' }).click();
    await expect(categoryButton(sheet, 'Manicure')).toBeVisible();

    await sheet.getByRole('textbox', { name: 'Nova categoria' }).fill('Pedicure');
    await sheet.getByRole('button', { name: 'Criar categoria' }).click();
    await expect(categoryButton(sheet, 'Pedicure')).toBeVisible();

    // Manicure was created first, so it starts above Pedicure.
    const rows = sheet.locator('.category-management-item');
    await expect(rows.nth(0).locator('.category-management-name')).toHaveText('Manicure');
    await expect(rows.nth(1).locator('.category-management-name')).toHaveText('Pedicure');

    await rows.nth(1).getByRole('button', { name: 'Mover para cima' }).click();
    await expect(rows.nth(0).locator('.category-management-name')).toHaveText('Pedicure');
    await expect(rows.nth(1).locator('.category-management-name')).toHaveText('Manicure');
  });
});
