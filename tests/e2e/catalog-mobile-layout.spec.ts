import { expect, test, type Page } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

// Regression guard for NEX-044: a CSS grid/flex item without an explicit shrink bound
// (missing grid-template-columns, or an <input> with no min-width) silently forces
// horizontal overflow on narrow viewports — the whole page zooms/scrolls sideways on a
// real phone instead of wrapping. Playwright's viewport doesn't reproduce that visually,
// so this asserts directly on scrollWidth vs clientWidth instead.
async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

test.describe('catalog mobile layout (NEX-044)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.beforeEach(async ({ page }) => {
    user = await createProvisionedTestUser('nex044');
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

  test('no horizontal overflow with empty categories/services/packages', async ({ page }) => {
    await expectNoHorizontalOverflow(page);
  });

  test('no horizontal overflow once a category, service and package exist', async ({ page }) => {
    // exact:true: a category-less tenant also shows a "Gerir categorias" empty-state
    // button (same effect, different trigger) — a plain substring match would catch
    // both.
    await page.getByRole('button', { name: 'Gerir', exact: true }).click();
    const categorySheet = page.getByRole('dialog', { name: 'Gerir categorias' });
    await categorySheet.getByRole('textbox', { name: 'Nova categoria' }).fill('Manicure');
    await categorySheet.getByRole('button', { name: 'Criar categoria' }).click();
    await categorySheet.getByRole('button', { name: 'Manicure', exact: true }).waitFor();
    await categorySheet.getByRole('button', { name: 'Fechar' }).click();

    // The header's "Novo serviço" and the floating action button share the same
    // accessible name outside the Pacotes tab (ServicesFab) — scoped to the header
    // trigger's own class to disambiguate.
    await page.locator('.services-header button.new-service-button').click();
    const serviceSheet = page.getByRole('dialog', { name: 'Novo serviço' });
    await serviceSheet.locator('#service-name').fill('Verniz gel');
    await serviceSheet.locator('#service-price').fill('25,00');
    await serviceSheet.getByRole('button', { name: '60 min' }).click();
    await serviceSheet.getByRole('button', { name: 'Criar serviço' }).click();
    await page.locator('.service-card-name', { hasText: 'Verniz gel' }).waitFor();

    await page.getByRole('link', { name: 'Pacotes', exact: true }).click();
    await page.getByRole('button', { name: 'Novo pacote' }).click();
    const packageSheet = page.getByRole('dialog', { name: 'Novo pacote' });
    await packageSheet.locator('input[name="name"]').fill('Combo longo para testar overflow');
    await packageSheet.locator('input[name="priceEuros"]').fill('45,00');
    await packageSheet.getByLabel('Escolher serviço para adicionar').selectOption({
      label: 'Verniz gel · 60 min',
    });
    await packageSheet.getByRole('button', { name: 'Adicionar' }).click();
    await packageSheet.getByRole('button', { name: 'Criar pacote' }).click();
    await page
      .locator('.service-card-name', { hasText: 'Combo longo para testar overflow' })
      .waitFor();

    await expectNoHorizontalOverflow(page);
  });
});
