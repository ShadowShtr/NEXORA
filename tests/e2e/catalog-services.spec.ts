import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

// Categories and services now live behind dedicated sheets (CategoryManagementSheet,
// ServiceEditorSheet) instead of inline forms in the main list — "a lista serve para
// consultar e gerir rapidamente; os formulários pertencem a telas separadas" (Serviços
// reference, src/app/(dashboard)/dashboard/servicos/page.tsx). These helpers open the
// relevant sheet, act, and (for categories) close it again so the next helper can open
// a different one — only one sheet can be open at a time (CatalogSheetProvider).
async function createCategory(page: Page, name: string) {
  // exact:true: a category-less tenant also shows a "Gerir categorias" empty-state
  // button (same effect, different trigger) — a plain substring match would catch
  // both.
  await page.getByRole('button', { name: 'Gerir', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Gerir categorias' });
  await sheet.getByRole('textbox', { name: 'Nova categoria' }).fill(name);
  await sheet.getByRole('button', { name: 'Criar categoria' }).click();
  // The name renders as a click-to-edit button (.category-management-name) — its
  // "Nome da categoria X" aria-label only exists on the swapped-in rename input.
  await expect(sheet.getByRole('button', { name, exact: true })).toBeVisible();
  await sheet.getByRole('button', { name: 'Fechar' }).click();
}

async function createService(
  page: Page,
  {
    name,
    priceEuros,
    durationMinutes,
  }: { name: string; priceEuros: string; durationMinutes?: number },
) {
  // The header's "Novo serviço" and the floating action button share the same
  // accessible name once a category exists (ServicesFab is also labelled "Novo
  // serviço" outside the Pacotes tab) — scoped to the header trigger's own class to
  // disambiguate.
  await page.locator('.services-header button.new-service-button').click();
  const sheet = page.getByRole('dialog', { name: 'Novo serviço' });
  await sheet.locator('#service-name').fill(name);
  await sheet.locator('#service-price').fill(priceEuros);
  if (durationMinutes) await sheet.getByRole('button', { name: `${durationMinutes} min` }).click();
  await sheet.getByRole('button', { name: 'Criar serviço' }).click();
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
    await createService(page, { name: 'Verniz gel', priceEuros: '25,50', durationMinutes: 45 });

    await expect(page.locator('.service-card-name').first()).toHaveText('Verniz gel');

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
    await expect(page.locator('.service-card-name').first()).toHaveText('Verniz gel');

    await page.locator('.services-header button.new-service-button').click();
    const sheet = page.getByRole('dialog', { name: 'Novo serviço' });
    await sheet.locator('#service-name').fill('Verniz gel');
    await sheet.locator('#service-price').fill('30,00');
    await sheet.getByRole('button', { name: 'Criar serviço' }).click();
    await expect(sheet.locator('[role="alert"].form-error')).toContainText('Já existe');

    await sheet.getByRole('button', { name: 'Fechar' }).click();
    // Still only the one card — the duplicate attempt was rejected, not persisted.
    await expect(page.locator('.service-card-item')).toHaveCount(1);
  });

  test('edits a service (name, price, duration, category)', async ({ page }) => {
    await createCategory(page, 'Manicure');
    await createCategory(page, 'Pedicure');
    await createService(page, { name: 'Verniz gel', priceEuros: '25,00' });
    await expect(page.locator('.service-card-name').first()).toHaveText('Verniz gel');

    await page.locator('.service-card-open', { hasText: 'Verniz gel' }).click();
    const sheet = page.getByRole('dialog', { name: 'Editar serviço' });
    await sheet.locator('#service-name').fill('Verniz gel premium');
    await sheet.locator('#service-price').fill('35,00');
    await sheet.locator('#service-category').selectOption({ label: 'Pedicure' });
    await sheet.getByRole('button', { name: 'Guardar' }).click();

    await expect(page.locator('.service-card-name').first()).toHaveText('Verniz gel premium');

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

    const card = page.locator('.service-card-item').first();
    await expect(card.locator('.service-card-name')).toHaveText('Verniz gel');

    // role="switch" (ServiceCard's active toggle) overrides the element's native
    // <button> role for accessibility purposes.
    await card.getByRole('switch', { name: 'Desativar' }).click();
    await expect(card.getByText('Inativo — não é oferecido')).toBeVisible();

    await card.getByRole('switch', { name: 'Ativar' }).click();
    await expect(card.getByText('Inativo — não é oferecido')).toHaveCount(0);
  });
});
