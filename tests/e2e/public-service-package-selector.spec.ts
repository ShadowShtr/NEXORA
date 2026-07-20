import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

// Seeds two individual services (Verniz gel, Massagem) and one package that only
// covers Verniz gel — Massagem stays a genuine "extra" the client can add on top,
// exercising the PRD 01 §4 requirement: "A cliente pode combinar pacote com extras,
// sem duplicação de itens já incluídos."
async function seedServicesAndPackage(user: ProvisionedTestUser) {
  const { data: tenant } = await user.admin
    .from('tenants')
    .select('id')
    .eq('slug', user.slug)
    .single();
  await user.admin
    .from('business_settings')
    .update({ phone_e164: '+351912345678', published_at: new Date().toISOString() })
    .eq('tenant_id', tenant!.id);
  await user.admin.from('tenants').update({ status: 'active' }).eq('id', tenant!.id);
  const { data: category } = await user.admin
    .from('service_categories')
    .insert({ tenant_id: tenant!.id, name: 'Manicure' })
    .select('id')
    .single();
  const { data: verniz } = await user.admin
    .from('services')
    .insert({
      tenant_id: tenant!.id,
      category_id: category!.id,
      name: 'Verniz gel',
      price_cents: 2500,
      duration_minutes: 60,
    })
    .select('id')
    .single();
  await user.admin.from('services').insert({
    tenant_id: tenant!.id,
    category_id: category!.id,
    name: 'Massagem',
    price_cents: 3000,
    duration_minutes: 45,
  });
  const { data: pkg } = await user.admin
    .from('packages')
    .insert({ tenant_id: tenant!.id, name: 'Combo verniz', price_cents: 2200 })
    .select('id')
    .single();
  await user.admin
    .from('package_services')
    .insert({ tenant_id: tenant!.id, package_id: pkg!.id, service_id: verniz!.id });
}

// NEX-053: services grouped by category (checkboxes), a single-choice package selector,
// and "extras" — services not already covered by the chosen package can still be added,
// but the total/summary never double-counts a service the package already includes.
test.describe('public services/packages selector (NEX-053)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.afterEach(async () => {
    await cleanupProvisionedTestUser(user);
  });

  test('has no automatic accessibility violations with a package selected', async ({ page }) => {
    user = await createProvisionedTestUser('nex053');
    await seedServicesAndPackage(user);

    await page.goto(`/b/${user.slug}`);
    await page.getByRole('radio', { name: /Combo verniz/ }).check();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('selecting a package charges it once, not the package plus its included service', async ({
    page,
  }) => {
    user = await createProvisionedTestUser('nex053');
    await seedServicesAndPackage(user);

    await page.goto(`/b/${user.slug}`);
    await page.getByRole('radio', { name: /Combo verniz/ }).check();

    // Verniz gel is covered by the package: shown as included, disabled, and not
    // separately billed.
    const vernizCheckbox = page.getByRole('checkbox', { name: /Verniz gel/ });
    await expect(vernizCheckbox).toBeChecked();
    await expect(vernizCheckbox).toBeDisabled();
    await expect(page.getByText('Incluído no pacote')).toBeVisible();
    await expect(page.getByText('Total: 22,00 € · 60 min')).toBeVisible();

    // Massagem is a genuine extra: adding it on top increases the total normally.
    await page.getByRole('checkbox', { name: 'Massagem' }).check();
    await expect(page.getByText('Total: 52,00 € · 105 min')).toBeVisible();
  });

  test('checking a service first, then choosing a package that covers it, drops the duplicate automatically', async ({
    page,
  }) => {
    user = await createProvisionedTestUser('nex053');
    await seedServicesAndPackage(user);

    await page.goto(`/b/${user.slug}`);

    await page.getByRole('checkbox', { name: /Verniz gel/ }).check();
    await expect(page.getByText('Total: 25,00 € · 60 min')).toBeVisible();

    await page.getByRole('radio', { name: /Combo verniz/ }).check();

    // The standalone selection is dropped, not added on top of the package.
    await expect(page.getByText('Total: 22,00 € · 60 min')).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Verniz gel/ })).toBeDisabled();
  });

  test('"Nenhum pacote" clears the package and restores normal selection', async ({ page }) => {
    user = await createProvisionedTestUser('nex053');
    await seedServicesAndPackage(user);

    await page.goto(`/b/${user.slug}`);
    await page.getByRole('radio', { name: /Combo verniz/ }).check();
    await expect(page.getByRole('checkbox', { name: /Verniz gel/ })).toBeDisabled();

    await page.getByRole('radio', { name: 'Nenhum pacote' }).check();

    const vernizCheckbox = page.getByRole('checkbox', { name: /Verniz gel/ });
    await expect(vernizCheckbox).toBeEnabled();
    await expect(vernizCheckbox).not.toBeChecked();
    await expect(page.getByText('Escolha pelo menos um serviço ou pacote acima.')).toBeVisible();
  });

  test('is fully operable by keyboard alone', async ({ page }) => {
    user = await createProvisionedTestUser('nex053');
    await seedServicesAndPackage(user);

    await page.goto(`/b/${user.slug}`);

    await page.getByRole('checkbox', { name: 'Massagem' }).focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('checkbox', { name: 'Massagem' })).toBeChecked();

    await page.getByRole('radio', { name: /Combo verniz/ }).focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('radio', { name: /Combo verniz/ })).toBeChecked();

    await expect(page.getByText('Total: 52,00 € · 105 min')).toBeVisible();
  });
});
