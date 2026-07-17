import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

test.describe('password recovery (NEX-021)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.beforeAll(async () => {
    user = await createProvisionedTestUser('nex021');
  });

  test.afterAll(async () => {
    await cleanupProvisionedTestUser(user);
  });

  test('does not reveal whether an e-mail exists', async ({ page }) => {
    await page.goto('/recuperar-password');
    await page.getByLabel('E-mail').fill(`does-not-exist-${Date.now()}@example.test`);
    await page.getByRole('button', { name: 'Enviar link de recuperação' }).click();
    await expect(page.getByRole('heading', { name: 'Verifique o seu e-mail' })).toBeVisible();
  });

  test('completes the recovery flow with a real link, enforces single use, and logs in with the new password', async ({
    page,
  }) => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://127.0.0.1:3000';
    const { data, error } = await user.admin.auth.admin.generateLink({
      type: 'recovery',
      email: user.email,
      options: { redirectTo: `${appUrl}/definir-password` },
    });
    if (error) throw error;

    await page.goto(data.properties.action_link);
    await expect(page.getByRole('heading', { name: 'Definir nova palavra-passe' })).toBeVisible();

    const newPassword = `NovaPass-${Date.now()}!`;
    await page.getByLabel('Nova palavra-passe', { exact: true }).fill(newPassword);
    await page.getByRole('button', { name: 'Guardar palavra-passe' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Token is single-use: the same link must not establish a session a second time.
    await page.context().clearCookies();
    await page.goto(data.properties.action_link);
    await expect(page.getByRole('heading', { name: 'Link inválido ou expirado' })).toBeVisible();

    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(newPassword);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
