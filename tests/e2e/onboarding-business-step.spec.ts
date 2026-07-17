import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';
import { fillBusinessStep } from './support/onboarding';

test.describe('onboarding business step (NEX-031)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.beforeEach(async ({ page }) => {
    user = await createProvisionedTestUser('nex031');
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/onboarding');
  });

  test.afterEach(async () => {
    await cleanupProvisionedTestUser(user);
  });

  test('has no automatic accessibility violations', async ({ page }) => {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('normalizes a local phone number to E.164 before saving', async ({ page }) => {
    await fillBusinessStep(page, { phone: '910 000 000' });
    await page.getByRole('button', { name: 'Seguinte' }).click();
    await expect(page.getByText('Passo 2 de 5')).toBeVisible();

    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    const { data: settings } = await user.admin
      .from('business_settings')
      .select('phone_e164')
      .eq('tenant_id', tenant!.id)
      .single();
    expect(settings?.phone_e164).toBe('+351910000000');
  });

  test('rejects a maps URL that is not a known map provider', async ({ page }) => {
    await fillBusinessStep(page, { mapsUrl: 'https://evil.example.com/track?redirect=/dashboard' });
    await page.getByRole('button', { name: 'Seguinte' }).click();

    await expect(page.locator('[role="alert"].form-error')).toContainText(
      'Google Maps ou Apple Maps',
    );
    await expect(page.getByText('Passo 1 de 5')).toBeVisible();
  });

  test('accepts a real Google Maps link and advances', async ({ page }) => {
    await fillBusinessStep(page, { mapsUrl: 'https://maps.google.com/?q=Lisboa' });
    await page.getByRole('button', { name: 'Seguinte' }).click();

    await expect(page.getByText('Passo 2 de 5')).toBeVisible();
  });
});
