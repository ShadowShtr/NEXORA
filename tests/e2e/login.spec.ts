import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

test.describe('login / logout (NEX-020)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.beforeAll(async () => {
    user = await createProvisionedTestUser('nex020');
  });

  test.afterAll(async () => {
    await cleanupProvisionedTestUser(user);
  });

  test('shows a generic error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill('wrong-password');
    await page.getByRole('button', { name: 'Entrar' }).click();

    // Next.js's own route announcer (#__next-route-announcer__) also has role="alert",
    // so scope to the form's error message specifically.
    await expect(page.locator('[role="alert"].form-error')).toHaveText(
      'E-mail ou palavra-passe incorretos.',
    );
    await expect(page).toHaveURL(/\/login/);
  });

  test('logs in successfully and can log out', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL(/\/dashboard/);

    // Logout lives in the app shell (NEX-023): directly in the sidebar on desktop,
    // behind the "Mais" panel on mobile.
    const isMobile = (page.viewportSize()?.width ?? 1280) < 761;
    if (isMobile) {
      await page.locator('.mobile-nav').getByRole('button', { name: 'Mais' }).click();
      await page.locator('.mobile-nav-more').getByRole('button', { name: 'Sair' }).click();
    } else {
      await page.locator('.desktop-nav').getByRole('button', { name: 'Sair' }).click();
    }
    await expect(page).toHaveURL(/\/login/);
  });
});
