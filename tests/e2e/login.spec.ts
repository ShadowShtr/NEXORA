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

  test('reveals the password when the show/hide toggle is clicked', async ({ page }) => {
    await page.goto('/login');
    const passwordInput = page.getByLabel('Palavra-passe');
    await passwordInput.fill('some-password');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    await page.getByRole('button', { name: 'Mostrar palavra-passe' }).click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    await page.getByRole('button', { name: 'Ocultar palavra-passe' }).click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('redirects an already-authenticated visitor away from /login, back to /dashboard', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/login');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('logs in successfully and can log out', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL(/\/dashboard/);

    // Logout lives in the app shell (NEX-023): directly in the sidebar on desktop,
    // on the "Mais" page on mobile. Both render the same discreet, confirm-first
    // LogoutSection (features/shell/LogoutSection.tsx) — a "Terminar sessão" trigger
    // that opens a bottom sheet, not an immediate-submit button.
    const isMobile = (page.viewportSize()?.width ?? 1280) < 761;
    if (isMobile) {
      await page.locator('.mobile-nav').getByRole('link', { name: 'Mais' }).click();
    }
    const navScope = isMobile ? page : page.locator('.desktop-nav');
    await navScope.getByRole('button', { name: 'Terminar sessão' }).click();
    await page
      .getByRole('dialog', { name: 'Terminar sessão?' })
      .getByRole('button', { name: 'Terminar sessão' })
      .click();
    await expect(page).toHaveURL(/\/login/);
  });
});
