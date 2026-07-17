import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';
import { completeBusinessStep } from './support/onboarding';

test.describe('onboarding wizard engine (NEX-030)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.beforeAll(async () => {
    user = await createProvisionedTestUser('nex030');
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
    await page.goto('/onboarding');
  });

  test('a fresh tenant starts at step 1 without a "Voltar" button', async ({ page }) => {
    await expect(page.getByText('Passo 1 de 5')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Voltar' })).toHaveCount(0);
  });

  test('advancing persists across reload and re-entry', async ({ page }) => {
    await completeBusinessStep(page);
    await expect(page.getByText('Passo 2 de 5')).toBeVisible();

    await page.reload();
    await expect(page.getByText('Passo 2 de 5')).toBeVisible();

    // Re-entry from a fresh navigation (not just an in-place reload).
    await page.goto('/dashboard');
    await page.goto('/onboarding');
    await expect(page.getByText('Passo 2 de 5')).toBeVisible();
  });

  test('allows going back to a previous step', async ({ page }) => {
    await completeBusinessStep(page);
    await expect(page.getByText('Passo 2 de 5')).toBeVisible();

    await page.getByRole('button', { name: 'Seguinte' }).click();
    await expect(page.getByText('Passo 3 de 5')).toBeVisible();

    await page.getByRole('button', { name: 'Voltar' }).click();
    await expect(page.getByText('Passo 2 de 5')).toBeVisible();
  });
});
