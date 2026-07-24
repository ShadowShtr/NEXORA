import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

const IOS_SAFARI_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

// NEX-152: "Manifest e instalação PWA — instruções", required test category
// "Lighthouse/Android/iOS manual" — the iOS half can't be exercised by Lighthouse (it
// only audits Chromium/Android installability), so this covers it directly: iOS Safari
// never fires `beforeinstallprompt`, so InstallAppCard falls back to a static
// instruction line instead of a button. The Android/desktop `beforeinstallprompt` path
// itself isn't simulated here — Chromium only fires it once real installability
// criteria are met (service worker, HTTPS/localhost, valid manifest), which a
// Playwright run against `next dev` doesn't satisfy — so what's verified there is the
// safe default: no actionable install path means no card at all, never a dead one.
test.describe('cartão de instalação — sem caminho acionável (NEX-152)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.beforeAll(async () => {
    user = await createProvisionedTestUser('nex152a');
  });

  test.afterAll(async () => {
    await cleanupProvisionedTestUser(user);
  });

  test('does not render when neither iOS nor a native install prompt is available', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/dashboard/mais');
    await expect(page.getByRole('heading', { name: 'Mais' })).toBeVisible();
    await expect(page.locator('.more-install-card')).toHaveCount(0);
  });
});

test.describe('cartão de instalação — iOS Safari (NEX-152)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  test.use({ userAgent: IOS_SAFARI_USER_AGENT });

  let user: ProvisionedTestUser;

  test.beforeAll(async () => {
    user = await createProvisionedTestUser('nex152b');
  });

  test.afterAll(async () => {
    await cleanupProvisionedTestUser(user);
  });

  test('shows manual "Adicionar ao Ecrã Principal" instructions, no install button', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/dashboard/mais');
    const installCard = page.locator('.more-install-card');
    await expect(installCard).toBeVisible();
    await expect(installCard.getByText('Adicionar ao Ecrã Principal')).toBeVisible();
    await expect(installCard.getByRole('button', { name: 'Instalar' })).toHaveCount(0);
  });
});
