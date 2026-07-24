import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

// NEX-150: "Design system claymorphism — tokens, componentes e contraste AA", required
// test category "Visual + axe". Início (dashboard-shell.spec.ts) and Serviços
// (catalog-*.spec.ts) already had axe coverage; this closes the gap for the three other
// pages CLAUDE.md gives their own mandatory-fidelity section to (Agenda, Clientes,
// Mais) — the pages most representative of the claymorphism design system in practice.
// Like definicoes-hub.spec.ts (NEX-140), playwright.config.ts already runs every spec
// against both a desktop and a mobile project, so one sweep per page covers "mobile" too.
test.describe('design system — axe (NEX-150)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.beforeAll(async () => {
    user = await createProvisionedTestUser('nex150');
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

  test('agenda has no automatic accessibility violations', async ({ page }) => {
    await page.goto('/dashboard/agenda');
    await expect(page.getByRole('heading', { name: 'Agenda' })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('clientes has no automatic accessibility violations', async ({ page }) => {
    await page.goto('/dashboard/clientes');
    await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('mais has no automatic accessibility violations', async ({ page }) => {
    await page.goto('/dashboard/mais');
    await expect(page.getByRole('heading', { name: 'Mais' })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
