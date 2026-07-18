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
    await page.getByRole('textbox', { name: 'Nova categoria' }).fill('Manicure');
    await page.getByRole('button', { name: 'Criar categoria' }).click();
    await page.getByLabel('Nome da categoria Manicure').waitFor();

    const serviceForm = page.locator('form[aria-label="Novo serviço"]');
    await serviceForm.locator('input[name="name"]').fill('Verniz gel');
    await serviceForm.locator('input[name="priceEuros"]').fill('25,00');
    await serviceForm.locator('input[name="durationMinutes"]').fill('60');
    await serviceForm.getByRole('button', { name: 'Criar serviço' }).click();
    await page.locator('section[aria-label="Serviços"] .catalog-row').first().waitFor();

    const packageForm = page.locator('form[aria-label="Novo pacote"]');
    await packageForm.locator('input[name="name"]').fill('Combo longo para testar overflow');
    await packageForm.locator('input[name="priceEuros"]').fill('45,00');
    await packageForm.getByLabel('Escolher serviço para adicionar').selectOption({
      label: 'Verniz gel · 60 min',
    });
    await packageForm.getByRole('button', { name: 'Adicionar' }).click();
    await packageForm.getByRole('button', { name: 'Criar pacote' }).click();
    await page.locator('section[aria-label="Pacotes"] .catalog-row').first().waitFor();

    await expectNoHorizontalOverflow(page);
  });
});
