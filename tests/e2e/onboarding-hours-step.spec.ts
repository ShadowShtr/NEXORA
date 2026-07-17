import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';
import { completeBusinessStep } from './support/onboarding';

test.describe('onboarding hours step (NEX-032)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.beforeEach(async ({ page }) => {
    user = await createProvisionedTestUser('nex032');
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/onboarding');
    await completeBusinessStep(page);
    await expect(page.getByText('Passo 2 de 5')).toBeVisible();
  });

  test.afterEach(async () => {
    await cleanupProvisionedTestUser(user);
  });

  test('has no automatic accessibility violations', async ({ page }) => {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('loads pre-filled with the recommended defaults', async ({ page }) => {
    await expect(page.locator('[name="day-1-opensAt"]')).toHaveValue('09:00');
    await expect(page.locator('[name="day-1-closesAt"]')).toHaveValue('19:00');
    await expect(page.locator('[name="day-0-isOpen"]')).not.toBeChecked();
  });

  test('accepting the defaults advances and persists all 7 days', async ({ page }) => {
    await page.getByRole('button', { name: 'Seguinte' }).click();
    await expect(page.getByText('Passo 3 de 5')).toBeVisible();

    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    const { data: hours } = await user.admin
      .from('business_hours')
      .select('day_of_week, is_open')
      .eq('tenant_id', tenant!.id)
      .order('day_of_week');
    expect(hours).toHaveLength(7);
    expect(hours?.find((day) => day.day_of_week === 0)?.is_open).toBe(false);
    expect(hours?.find((day) => day.day_of_week === 1)?.is_open).toBe(true);
  });

  test('rejects a closing time at or before the opening time', async ({ page }) => {
    await page.locator('[name="day-1-opensAt"]').fill('19:00');
    await page.locator('[name="day-1-closesAt"]').fill('09:00');
    await page.getByRole('button', { name: 'Seguinte' }).click();

    await expect(page.locator('[role="alert"].form-error')).toContainText(
      'depois da hora de início',
    );
    await expect(page.getByText('Passo 2 de 5')).toBeVisible();
  });

  test('rejects setting only one lunch boundary', async ({ page }) => {
    await page.locator('[name="day-1-lunchEndsAt"]').fill('');
    await page.getByRole('button', { name: 'Seguinte' }).click();

    await expect(page.locator('[role="alert"].form-error')).toContainText('almoço');
    await expect(page.getByText('Passo 2 de 5')).toBeVisible();
  });

  test('"Voltar" returns to step 1 without requiring valid hours', async ({ page }) => {
    await page.locator('[name="day-1-closesAt"]').fill('01:00');
    await page.getByRole('button', { name: 'Voltar' }).click();
    await expect(page.getByText('Passo 1 de 5')).toBeVisible();
  });
});
