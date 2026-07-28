import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';
import { PublicBookingFlow } from './support/public-booking-flow';

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

// NEX-053: services grouped by category (checkboxes) and a single-choice package
// selector — "extras" (services not already covered by the chosen package) can still
// be added, but the total never double-counts a service the package already includes.
// Visual refinement mid-2026 split them into two tabs of the same /servicos step
// ("Serviços" / "Pacotes") instead of showing both lists at once — switching tabs is
// required before interacting with whichever list is currently hidden.
test.describe('public services/packages selector (NEX-053)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.afterEach(async () => {
    await cleanupProvisionedTestUser(user);
  });

  test('has no automatic accessibility violations with a package selected', async ({ page }) => {
    user = await createProvisionedTestUser('nex053');
    await seedServicesAndPackage(user);
    const flow = new PublicBookingFlow(page);

    await flow.startBooking(user.slug);
    await flow.selectPackage('Combo verniz');

    // Back on Serviços: this is where the package selection actually changes the
    // markup (disabled checkbox, "Incluído no pacote" note) — the more meaningful
    // surface to scan.
    await flow.goToServicesTab();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('selecting a package charges it once, not the package plus its included service', async ({
    page,
  }) => {
    user = await createProvisionedTestUser('nex053');
    await seedServicesAndPackage(user);
    const flow = new PublicBookingFlow(page);

    await flow.startBooking(user.slug);
    await flow.selectPackage('Combo verniz');
    await flow.goToServicesTab();

    // Verniz gel is covered by the package: shown as included, disabled, and not
    // separately billed.
    const vernizCheckbox = page.getByRole('checkbox', { name: /Verniz gel/ });
    await expect(vernizCheckbox).toBeChecked();
    await expect(vernizCheckbox).toBeDisabled();
    await expect(page.getByText('Incluído no pacote')).toBeVisible();
    const bar = flow.cartBar;
    await expect(bar.getByText('Total 1 Serviço')).toBeVisible();
    await expect(bar.getByText('22,00 €')).toBeVisible();

    // Massagem is a genuine extra: adding it on top increases the total normally.
    await flow.selectService('Massagem');
    await expect(bar.getByText('Total 2 Serviços')).toBeVisible();
    await expect(bar.getByText('52,00 €')).toBeVisible();
  });

  test('checking a service first, then choosing a package that covers it, drops the duplicate automatically', async ({
    page,
  }) => {
    user = await createProvisionedTestUser('nex053');
    await seedServicesAndPackage(user);
    const flow = new PublicBookingFlow(page);

    await flow.startBooking(user.slug);

    const bar = flow.cartBar;
    await flow.selectService('Verniz gel');
    await expect(bar.getByText('Total 1 Serviço')).toBeVisible();
    await expect(bar.getByText('25,00 €')).toBeVisible();

    await flow.selectPackage('Combo verniz');

    // The standalone selection is dropped, not added on top of the package.
    await expect(bar.getByText('Total 1 Serviço')).toBeVisible();
    await expect(bar.getByText('22,00 €')).toBeVisible();

    await flow.goToServicesTab();
    await expect(page.getByRole('checkbox', { name: /Verniz gel/ })).toBeDisabled();
  });

  test('"Nenhum pacote" clears the package and restores normal selection', async ({ page }) => {
    user = await createProvisionedTestUser('nex053');
    await seedServicesAndPackage(user);
    const flow = new PublicBookingFlow(page);

    await flow.startBooking(user.slug);
    await flow.selectPackage('Combo verniz');

    await flow.goToServicesTab();
    await expect(page.getByRole('checkbox', { name: /Verniz gel/ })).toBeDisabled();

    await flow.clearPackage();

    await flow.goToServicesTab();
    const vernizCheckbox = page.getByRole('checkbox', { name: /Verniz gel/ });
    await expect(vernizCheckbox).toBeEnabled();
    await expect(vernizCheckbox).not.toBeChecked();
    await expect(flow.cartBar.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  });

  test('is fully operable by keyboard alone', async ({ page }) => {
    user = await createProvisionedTestUser('nex053');
    await seedServicesAndPackage(user);
    const flow = new PublicBookingFlow(page);

    await flow.startBooking(user.slug);

    const massagemCheckbox = page.getByRole('checkbox', { name: 'Massagem' });
    await massagemCheckbox.focus();
    await expect(massagemCheckbox).toBeFocused();
    await page.keyboard.press('Space');
    await expect(massagemCheckbox).toBeChecked();

    await page.getByRole('tab', { name: 'Pacotes' }).click();
    const comboRadio = page.getByRole('radio', { name: /Combo verniz/ });
    await comboRadio.focus();
    await expect(comboRadio).toBeFocused();
    await page.keyboard.press('Space');
    await expect(comboRadio).toBeChecked();

    const bar = flow.cartBar;
    await expect(bar.getByText('Total 2 Serviços')).toBeVisible();
    await expect(bar.getByText('52,00 €')).toBeVisible();
  });
});
