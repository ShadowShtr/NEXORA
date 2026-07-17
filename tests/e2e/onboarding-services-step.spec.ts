import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';
import { addServiceItem, completeBusinessStep, completeHoursStep } from './support/onboarding';

test.describe('onboarding services step (NEX-033)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.beforeEach(async ({ page }) => {
    user = await createProvisionedTestUser('nex033');
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/onboarding');
    await completeBusinessStep(page);
    await completeHoursStep(page);
    await expect(page.getByText('Passo 3 de 5')).toBeVisible();
  });

  test.afterEach(async () => {
    await cleanupProvisionedTestUser(user);
  });

  test('has no automatic accessibility violations', async ({ page }) => {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('requires at least one service before advancing', async ({ page }) => {
    await page.getByRole('button', { name: 'Seguinte' }).click();
    await expect(page.locator('[role="alert"].form-error')).toContainText('pelo menos um serviço');
    await expect(page.getByText('Passo 3 de 5')).toBeVisible();
  });

  test('supports adding services repeatedly, each persisted', async ({ page }) => {
    await addServiceItem(page, { name: 'Verniz gel', categoryName: 'Manicure' });
    await expect(page.getByText('Verniz gel')).toBeVisible();

    await addServiceItem(page, {
      name: 'Pedicure spa',
      priceEuros: '30,00',
      categoryName: 'Pedicure',
    });
    await expect(page.getByText('Pedicure spa')).toBeVisible();

    await page.getByRole('button', { name: 'Seguinte' }).click();
    await expect(page.getByText('Passo 4 de 5')).toBeVisible();

    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    const { data: services } = await user.admin
      .from('services')
      .select('name, price_cents, duration_minutes')
      .eq('tenant_id', tenant!.id)
      .order('created_at');
    expect(services).toHaveLength(2);
    expect(services?.[0]).toMatchObject({
      name: 'Verniz gel',
      price_cents: 2500,
      duration_minutes: 60,
    });
    expect(services?.[1]).toMatchObject({ name: 'Pedicure spa', price_cents: 3000 });

    const { data: categories } = await user.admin
      .from('service_categories')
      .select('name')
      .eq('tenant_id', tenant!.id)
      .order('name');
    expect(categories?.map((c) => c.name)).toEqual(['Manicure', 'Pedicure']);
  });

  test('rejects a duplicate service name for the same tenant', async ({ page }) => {
    await addServiceItem(page, { name: 'Verniz gel' });
    await expect(page.getByText('Verniz gel')).toBeVisible();

    await addServiceItem(page, { name: 'Verniz gel', categoryName: 'Manicure' });
    await expect(page.locator('[role="alert"].form-error')).toContainText('Já existe um serviço');

    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    const { count } = await user.admin
      .from('services')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant!.id);
    expect(count).toBe(1);
  });

  test('reuses an existing category instead of creating a duplicate', async ({ page }) => {
    await addServiceItem(page, { name: 'Verniz gel', categoryName: 'Manicure' });
    await addServiceItem(page, { name: 'Manicure spa', categoryName: 'Manicure' });

    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    const { count } = await user.admin
      .from('service_categories')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant!.id)
      .eq('name', 'Manicure');
    expect(count).toBe(1);
  });

  test('"Voltar" returns to step 2', async ({ page }) => {
    await page.getByRole('button', { name: 'Voltar' }).click();
    await expect(page.getByText('Passo 2 de 5')).toBeVisible();
  });
});
