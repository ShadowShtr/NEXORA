import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

// NEX-090 acceptance criteria: "Busca por nome/telefone, paginação e empty state" +
// "RLS/performance" — the client list/search must reflect only the signed-in owner's
// own tenant, page correctly, and show a clear empty state.
test.describe('clients search (NEX-090)', () => {
  test.skip(!canUseSupabase(), 'Requires Supabase credentials');

  let user: ProvisionedTestUser;
  let otherTenant: ProvisionedTestUser;

  test.afterEach(async () => {
    if (user) await cleanupProvisionedTestUser(user);
    if (otherTenant) await cleanupProvisionedTestUser(otherTenant);
  });

  test('shows an empty state with no clients yet', async ({ page }) => {
    user = await createProvisionedTestUser('nex090-empty');

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/dashboard/clientes');

    await expect(page.getByText('Ainda não tem clientes registadas.')).toBeVisible();
  });

  test("finds a client by partial name and by phone, and never shows another tenant's client", async ({
    page,
  }) => {
    user = await createProvisionedTestUser('nex090');
    otherTenant = await createProvisionedTestUser('nex090-other');

    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    const { data: otherTenantRow } = await otherTenant.admin
      .from('tenants')
      .select('id')
      .eq('slug', otherTenant.slug)
      .single();

    await user.admin
      .from('clients')
      .insert({ tenant_id: tenant!.id, name: 'Ana Ferreira', phone_e164: '+351911111111' });
    await otherTenant.admin.from('clients').insert({
      tenant_id: otherTenantRow!.id,
      name: 'Ana De Outro Tenant',
      phone_e164: '+351922222222',
    });

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/dashboard/clientes');

    await expect(page.getByText('Ana Ferreira')).toBeVisible();
    await expect(page.getByText('Ana De Outro Tenant')).toHaveCount(0);

    await page.getByLabel('Pesquisar por nome ou telemóvel').fill('ferreira');
    await page.getByRole('button', { name: 'Pesquisar' }).click();
    await expect(page.getByText('Ana Ferreira')).toBeVisible();

    await page.getByLabel('Pesquisar por nome ou telemóvel').fill('911111111');
    await page.getByRole('button', { name: 'Pesquisar' }).click();
    await expect(page.getByText('Ana Ferreira')).toBeVisible();

    await page.getByLabel('Pesquisar por nome ou telemóvel').fill('nao-existe-xyz');
    await page.getByRole('button', { name: 'Pesquisar' }).click();
    await expect(page.getByText('Nenhuma cliente encontrada para essa pesquisa.')).toBeVisible();
  });

  test('paginates when there are more than 20 clients', async ({ page }) => {
    user = await createProvisionedTestUser('nex090-page');
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();

    await user.admin.from('clients').insert(
      Array.from({ length: 25 }, (_, i) => ({
        tenant_id: tenant!.id,
        name: `Cliente ${String(i).padStart(2, '0')}`,
        phone_e164: `+35191${String(1000000 + i).padStart(7, '0')}`,
      })),
    );

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/dashboard/clientes');

    await expect(page.getByText('Página 1 de 2')).toBeVisible();
    await expect(page.locator('.clients-list-item')).toHaveCount(20);

    await page.getByRole('link', { name: 'Seguinte' }).click();
    await expect(page.getByText('Página 2 de 2')).toBeVisible();
    await expect(page.locator('.clients-list-item')).toHaveCount(5);
  });
});
