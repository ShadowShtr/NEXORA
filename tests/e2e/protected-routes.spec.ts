import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
} from './support/provisioned-user';

test.describe('protected routes (NEX-022)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  test('redirects unauthenticated access to /dashboard to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('rejects a forged/tampered session cookie', async ({ page, context }) => {
    const user = await createProvisionedTestUser('nex022-forge');
    try {
      await page.goto('/login');
      await page.getByLabel('E-mail').fill(user.email);
      await page.getByLabel('Palavra-passe').fill(user.password);
      await page.getByRole('button', { name: 'Entrar' }).click();
      await expect(page).toHaveURL(/\/dashboard/);

      const cookies = await context.cookies();
      const authCookies = cookies.filter((c) => c.name.startsWith('sb-'));
      expect(authCookies.length).toBeGreaterThan(0);

      await context.addCookies(
        authCookies.map((cookie) => ({
          ...cookie,
          value: `forged-${randomUUID()}-tampered`,
        })),
      );

      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/login/);
    } finally {
      await cleanupProvisionedTestUser(user);
    }
  });

  test('blocks an authenticated user without a profile', async ({ page }) => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const admin = createClient(url, serviceRoleKey);
    const email = `nex022-bare-${randomUUID()}@example.test`;
    const password = `Test-${randomUUID()}!`;

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;

    try {
      await page.goto('/login');
      await page.getByLabel('E-mail').fill(email);
      await page.getByLabel('Palavra-passe').fill(password);
      await page.getByRole('button', { name: 'Entrar' }).click();

      // Valid credentials, but no profile: the dashboard layout signs the user back
      // out and bounces to /login instead of granting access.
      await expect(page).toHaveURL(/\/login\?error=no_profile/);
      await expect(page.locator('[role="alert"].form-error')).toContainText(
        'ainda não está configurada',
      );
    } finally {
      await admin.auth.admin.deleteUser(data.user.id);
    }
  });
});
