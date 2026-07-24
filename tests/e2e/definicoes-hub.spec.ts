import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

// NEX-140: "Central de definições em cartões" — this project's playwright.config.ts
// already runs every spec against both a desktop project (chromium) and a mobile one
// (webkit-mobile, iPhone 15), so a single axe sweep per page here covers this task's own
// required test category ("Axe/mobile") without a separate mobile-only test file.
const CATEGORY_PATHS = [
  '/dashboard/definicoes',
  '/dashboard/definicoes/negocio',
  '/dashboard/definicoes/agenda',
  '/dashboard/definicoes/marcacoes',
  '/dashboard/definicoes/lembretes',
  '/dashboard/definicoes/pagamentos',
  '/dashboard/definicoes/aparencia',
  '/dashboard/definicoes/dados',
];

test.describe('definições hub (NEX-140)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.beforeAll(async () => {
    user = await createProvisionedTestUser('nex140');
  });

  test.afterAll(async () => {
    await cleanupProvisionedTestUser(user);
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('the hub lists all 7 categories, each navigating to its own page', async ({ page }) => {
    await page.goto('/dashboard/definicoes');
    for (const label of [
      'Negócio',
      'Agenda',
      'Marcações',
      'Lembretes',
      'Pagamentos',
      'Aparência',
      'Dados',
    ]) {
      await expect(page.getByRole('link', { name: new RegExp(label) })).toBeVisible();
    }

    await page.getByRole('link', { name: /Agenda/ }).click();
    await expect(page).toHaveURL(/\/dashboard\/definicoes\/agenda/);
    await expect(page.getByRole('heading', { name: 'Agenda' })).toBeVisible();

    await page.getByRole('link', { name: 'Voltar a Definições' }).click();
    await expect(page).toHaveURL(/\/dashboard\/definicoes$/);
  });

  for (const path of CATEGORY_PATHS) {
    test(`${path} has no automatic accessibility violations`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
