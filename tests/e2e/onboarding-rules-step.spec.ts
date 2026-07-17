import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';
import {
  completeBusinessStep,
  completeHoursStep,
  completeServicesStep,
} from './support/onboarding';

test.describe('onboarding rules step (NEX-034)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.beforeEach(async ({ page }) => {
    user = await createProvisionedTestUser('nex034');
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/onboarding');
    await completeBusinessStep(page);
    await completeHoursStep(page);
    await completeServicesStep(page);
    await expect(page.getByText('Passo 4 de 5')).toBeVisible();
  });

  test.afterEach(async () => {
    await cleanupProvisionedTestUser(user);
  });

  test('has no automatic accessibility violations', async ({ page }) => {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('loads pre-filled with the recommended values', async ({ page }) => {
    await expect(page.getByLabel('Intervalo da agenda')).toHaveValue('30');
    await expect(page.getByLabel('Intervalo entre clientes')).toHaveValue('15');
    await expect(page.getByLabel('Antecedência mínima para marcar')).toHaveValue('3');
    await expect(page.getByLabel('Janela de marcação no futuro')).toHaveValue('60');
    await expect(page.getByLabel('Aviso mínimo para cancelar')).toHaveValue('24');
  });

  test('allows editing away from the recommendation and persists the edit', async ({ page }) => {
    await page.getByLabel('Intervalo da agenda').selectOption('60');
    await page.getByLabel('Janela de marcação no futuro').selectOption('90');
    await page.getByRole('button', { name: 'Seguinte' }).click();
    await expect(page.getByText('Passo 5 de 5')).toBeVisible();

    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    const { data: settings } = await user.admin
      .from('business_settings')
      .select('slot_interval_minutes, booking_window_days')
      .eq('tenant_id', tenant!.id)
      .single();
    expect(settings).toMatchObject({ slot_interval_minutes: 60, booking_window_days: 90 });
  });

  test('"Usar recomendações" resets edited fields back to the recommendation with one tap', async ({
    page,
  }) => {
    await page.getByLabel('Intervalo da agenda').selectOption('60');
    await page.getByLabel('Aviso mínimo para cancelar').selectOption('48');

    await page.getByRole('button', { name: 'Usar recomendações' }).click();

    await expect(page.getByLabel('Intervalo da agenda')).toHaveValue('30');
    await expect(page.getByLabel('Aviso mínimo para cancelar')).toHaveValue('24');
  });

  test('"Voltar" returns to step 3', async ({ page }) => {
    await page.getByRole('button', { name: 'Voltar' }).click();
    await expect(page.getByText('Passo 3 de 5')).toBeVisible();
  });
});
