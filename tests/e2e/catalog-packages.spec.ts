import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

// Categories/services/packages now live behind dedicated sheets instead of inline
// forms in the main list (see catalog-services.spec.ts's header comment) — these
// helpers open the relevant sheet, act, and close it again where a later step needs
// the main page interactive underneath (only one sheet can be open at a time).
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

async function createServiceViaForm(
  page: Page,
  name: string,
  priceEuros: string,
  durationMinutes: string,
) {
  // The header's "Novo serviço" and the floating action button share the same
  // accessible name outside the Pacotes tab (ServicesFab) — scoped to the header
  // trigger's own class to disambiguate.
  await page.locator('.services-header button.new-service-button').click();
  const sheet = page.getByRole('dialog', { name: 'Novo serviço' });
  await sheet.locator('#service-name').fill(name);
  await sheet.locator('#service-price').fill(priceEuros);
  await sheet.getByRole('button', { name: `${durationMinutes} min` }).click();
  await sheet.getByRole('button', { name: 'Criar serviço' }).click();
  await expect(page.locator('.service-card-name', { hasText: name })).toBeVisible();
}

// The FAB is tab-aware (ServicesFab.tsx): its accessible name and the sheet it opens
// depend on being on the "Pacotes" filter already.
async function goToPackagesTab(page: Page) {
  await page.getByRole('link', { name: 'Pacotes', exact: true }).click();
}

function packageEditorSheet(page: Page) {
  return page.getByRole('dialog', { name: 'Novo pacote' });
}

// Adds a service to a package cart (create form or a row's edit form) via the
// select + "Adicionar" flow (NEX-043) — the dropdown only ever lists services not
// already in the cart, so a duplicate add is structurally unreachable through the UI.
async function addToCart(scope: Locator, optionLabel: string) {
  await scope.getByLabel('Escolher serviço para adicionar').selectOption({ label: optionLabel });
  await scope.getByRole('button', { name: 'Adicionar' }).click();
}

test.describe('catalog packages CRUD (NEX-042/NEX-043)', () => {
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
    // A brand new tenant has no categories either, which would otherwise show the
    // category-first message instead — create one so this exercises the
    // packages-specific "needs a service" gate on its own.
    await createCategory(page, 'Manicure');
    await goToPackagesTab(page);
    await expect(page.getByText('Crie primeiro um serviço')).toBeVisible();
  });

  test('the cart recalculates totals as services are added and removed', async ({ page }) => {
    await createCategory(page, 'Manicure');
    await createServiceViaForm(page, 'Verniz gel', '25,00', '60');
    await createServiceViaForm(page, 'Pedicure spa', '30,00', '45');

    await goToPackagesTab(page);
    await page.getByRole('button', { name: 'Novo pacote' }).click();
    const packageForm = packageEditorSheet(page);
    await expect(packageForm.locator('.catalog-cart-total')).toHaveText(
      'Duração total: 0 min · Soma dos preços dos serviços: 0,00 €',
    );

    await addToCart(packageForm, 'Verniz gel · 60 min');
    await expect(packageForm.locator('.catalog-cart-total')).toHaveText(
      'Duração total: 60 min · Soma dos preços dos serviços: 25,00 €',
    );
    // Already-added services drop out of the picker — no way to add a duplicate.
    await expect(packageForm.getByLabel('Escolher serviço para adicionar')).not.toContainText(
      'Verniz gel',
    );
    await expect(packageForm.getByLabel('Escolher serviço para adicionar')).toContainText(
      'Pedicure spa',
    );

    await addToCart(packageForm, 'Pedicure spa · 45 min');
    await expect(packageForm.locator('.catalog-cart-total')).toHaveText(
      'Duração total: 105 min · Soma dos preços dos serviços: 55,00 €',
    );
    // Both services now added — the picker has nothing left to offer.
    await expect(packageForm.getByLabel('Escolher serviço para adicionar')).toHaveCount(0);

    await packageForm
      .locator('.catalog-cart-item', { hasText: 'Verniz gel' })
      .getByRole('button', { name: 'Remover' })
      .click();
    await expect(packageForm.locator('.catalog-cart-total')).toHaveText(
      'Duração total: 45 min · Soma dos preços dos serviços: 30,00 €',
    );
    // Removed services become available to add again.
    await expect(packageForm.getByLabel('Escolher serviço para adicionar')).toContainText(
      'Verniz gel',
    );
  });

  test('creates a package with two services, deriving the summed duration', async ({ page }) => {
    await createCategory(page, 'Manicure');
    await createServiceViaForm(page, 'Verniz gel', '25,00', '60');
    await createServiceViaForm(page, 'Pedicure spa', '30,00', '45');

    await goToPackagesTab(page);
    await page.getByRole('button', { name: 'Novo pacote' }).click();
    const packageForm = packageEditorSheet(page);
    await packageForm.locator('input[name="name"]').fill('Mãos e pés');
    await packageForm.locator('input[name="priceEuros"]').fill('45,00');
    await addToCart(packageForm, 'Verniz gel · 60 min');
    await addToCart(packageForm, 'Pedicure spa · 45 min');
    await packageForm.getByRole('button', { name: 'Criar pacote' }).click();

    const packageCard = page.locator('.service-card-item').first();
    await expect(packageCard.locator('.service-card-name')).toHaveText('Mãos e pés');
    await expect(packageCard).toContainText('45,00');
    await expect(packageCard).toContainText('105 min');

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
    await createServiceViaForm(page, 'Verniz gel', '25,00', '60');

    await goToPackagesTab(page);
    await page.getByRole('button', { name: 'Novo pacote' }).click();
    let packageForm = packageEditorSheet(page);
    await packageForm.locator('input[name="name"]').fill('Combo');
    await packageForm.locator('input[name="priceEuros"]').fill('20,00');
    await addToCart(packageForm, 'Verniz gel · 60 min');
    await packageForm.getByRole('button', { name: 'Criar pacote' }).click();
    await expect(page.locator('.service-card-item')).toHaveCount(1);

    await page.getByRole('button', { name: 'Novo pacote' }).click();
    packageForm = packageEditorSheet(page);
    await packageForm.locator('input[name="name"]').fill('Combo');
    await packageForm.locator('input[name="priceEuros"]').fill('22,00');
    await addToCart(packageForm, 'Verniz gel · 60 min');
    await packageForm.getByRole('button', { name: 'Criar pacote' }).click();
    await expect(packageForm.locator('[role="alert"].form-error')).toContainText('Já existe');
    await packageForm.getByRole('button', { name: 'Fechar' }).click();
    await expect(page.locator('.service-card-item')).toHaveCount(1);
  });

  test('activates and deactivates a package', async ({ page }) => {
    await createCategory(page, 'Manicure');
    await createServiceViaForm(page, 'Verniz gel', '25,00', '60');

    await goToPackagesTab(page);
    await page.getByRole('button', { name: 'Novo pacote' }).click();
    const packageForm = packageEditorSheet(page);
    await packageForm.locator('input[name="name"]').fill('Combo');
    await packageForm.locator('input[name="priceEuros"]').fill('20,00');
    await addToCart(packageForm, 'Verniz gel · 60 min');
    await packageForm.getByRole('button', { name: 'Criar pacote' }).click();

    const packageCard = page.locator('.service-card-item').first();
    await expect(packageCard.locator('.service-card-name')).toHaveText('Combo');

    // role="switch" (PackageCard's active toggle) overrides the element's native
    // <button> role for accessibility purposes.
    await packageCard.getByRole('switch', { name: 'Desativar' }).click();
    await expect(packageCard.getByText('Inativo — não é oferecido')).toBeVisible();

    await packageCard.getByRole('switch', { name: 'Ativar' }).click();
    await expect(packageCard.getByText('Inativo — não é oferecido')).toHaveCount(0);
  });
});
