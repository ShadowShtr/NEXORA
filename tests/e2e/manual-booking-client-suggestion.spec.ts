import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

// NEX-092 acceptance criteria: "Sugestões sem expor dados cruzados" + "Telefones
// equivalentes" — typing a "new" client's name/phone in the manual booking wizard's
// client step must surface an existing client from the same phone typed in a different
// format, and must never surface another tenant's client. Updated for the Nova marcação
// wizard redesign (mid-2026): the plain "Cliente existente"/"Nova cliente" radios are
// gone — this now goes through the wizard's "Criar nova cliente" sub-form instead.
test.describe('manual booking client suggestion (NEX-092)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;
  let otherTenant: ProvisionedTestUser;

  test.afterEach(async () => {
    if (user) await cleanupProvisionedTestUser(user);
    if (otherTenant) await cleanupProvisionedTestUser(otherTenant);
  });

  test('suggests an existing client when the phone is typed in a different (equivalent) format', async ({
    page,
  }) => {
    user = await createProvisionedTestUser('nex092');
    otherTenant = await createProvisionedTestUser('nex092-other');

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
      .insert({ tenant_id: tenant!.id, name: 'Ana Ferreira', phone_e164: '+351910000000' });
    // Same local number, different tenant — must never be suggested to this owner.
    await otherTenant.admin.from('clients').insert({
      tenant_id: otherTenantRow!.id,
      name: 'Ana De Outro Tenant',
      phone_e164: '+351910000000',
    });

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/dashboard/agenda/nova');

    await page.getByRole('button', { name: 'Criar nova cliente' }).click();
    // Typed with spaces/local format — normalizePhoneE164 must still match
    // +351910000000 stored for Ana Ferreira.
    await page.getByLabel('Telemóvel').fill('910 000 000');

    await expect(page.getByText('Já existe uma cliente parecida:')).toBeVisible();
    await expect(page.getByText('Ana Ferreira')).toBeVisible();
    await expect(page.getByText('Ana De Outro Tenant')).toHaveCount(0);

    await page.getByRole('button', { name: /Ana Ferreira/ }).click();
    // Selecting the suggestion swaps the new-client form for the selected-client card.
    await expect(page.locator('.selected-client-card')).toContainText('Ana Ferreira');
  });

  test('does not suggest anything for a name/phone that matches no existing client', async ({
    page,
  }) => {
    user = await createProvisionedTestUser('nex092-nomatch');

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/dashboard/agenda/nova');

    await page.getByRole('button', { name: 'Criar nova cliente' }).click();
    await page.getByLabel('Nome').fill('Cliente Totalmente Nova');
    await page.getByLabel('Telemóvel').fill('969999999');

    await expect(page.getByText('Já existe uma cliente parecida:')).toHaveCount(0);
  });
});
