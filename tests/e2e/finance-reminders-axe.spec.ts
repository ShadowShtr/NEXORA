import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

// NEX-154: "Auditoria WCAG 2.2 AA — problemas críticos corrigidos", required test
// category "axe". Closes gaps in axe coverage for exactly the pages where this task
// found and fixed real `color-contrast` failures (ad-hoc hex text colors below 4.5:1 —
// pending-payment amounts, reminder status badges/summary cards) — the fixes swapped
// those to design-system tokens already verified in
// tests/unit/design-tokens-contrast.test.ts, this is the rendered-page check.
// Financeiro/Lembretes/Relatórios had no axe coverage at all before this task.
test.describe('financeiro, lembretes, relatórios — axe (NEX-154)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.beforeAll(async () => {
    user = await createProvisionedTestUser('nex154');
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

  test('financeiro has no automatic accessibility violations', async ({ page }) => {
    await page.goto('/dashboard/financeiro');
    await expect(page.getByRole('heading', { name: 'Financeiro' })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('pagamentos pendentes has no automatic accessibility violations', async ({ page }) => {
    await page.goto('/dashboard/financeiro/pendentes');
    await expect(page.getByRole('heading', { name: 'Pagamentos pendentes' })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('lembretes has no automatic accessibility violations', async ({ page }) => {
    await page.goto('/dashboard/lembretes');
    await expect(page.getByRole('heading', { name: 'Lembretes' })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('relatórios has no automatic accessibility violations', async ({ page }) => {
    await page.goto('/dashboard/relatorios');
    await expect(page.getByRole('heading', { name: 'Relatórios' })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
