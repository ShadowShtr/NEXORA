import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';
import { completeRegistration } from './support/public-page';

// NEX-050: the public page relies entirely on the anon RLS policies already proven in
// NEX-012/NEX-035 (tenants.status='active', business_settings.published_at is not
// null, service_categories/services/packages visible/active) — these tests exercise
// that boundary through real anonymous page loads (no auth cookies), the same pattern
// used by the other public-page specs, rather than duplicating it as a separate
// integration test file.
test.describe('public business page /b/{slug} (NEX-050)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.afterEach(async () => {
    await cleanupProvisionedTestUser(user);
  });

  test('renders public business info, address, contact and catalog for a published tenant', async ({
    page,
  }) => {
    user = await createProvisionedTestUser('nex050');
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    await user.admin
      .from('business_settings')
      .update({
        professional_name: 'Sofia',
        phone_e164: '+351912345678',
        address_line: 'Rua Exemplo, 10',
        postal_code: '1000-001',
        locality: 'Lisboa',
        published_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenant!.id);
    await user.admin.from('tenants').update({ status: 'active' }).eq('id', tenant!.id);
    const { data: category } = await user.admin
      .from('service_categories')
      .insert({ tenant_id: tenant!.id, name: 'Manicure' })
      .select('id')
      .single();
    await user.admin.from('services').insert({
      tenant_id: tenant!.id,
      category_id: category!.id,
      name: 'Verniz gel',
      price_cents: 2500,
      duration_minutes: 60,
    });

    const response = await page.goto(`/b/${user.slug}`);
    expect(response?.status()).toBe(200);

    await expect(page.getByRole('heading', { name: 'Sofia' })).toBeVisible();
    await expect(page.getByText('Rua Exemplo, 10, 1000-001 Lisboa')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Marcar por WhatsApp' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ligar agora' })).toBeVisible();

    // Catalog sits behind Passo 1 (pré-cadastro, NEX-051) — completing it is required
    // to reach "booking integrado".
    await completeRegistration(page, 'Ana Cliente', '911111111');
    await expect(page.getByText('Verniz gel')).toBeVisible();
    await expect(page.getByText('60 min · 25,00 €')).toBeVisible();
  });

  test('has no automatic accessibility violations', async ({ page }) => {
    user = await createProvisionedTestUser('nex050');
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    await user.admin
      .from('business_settings')
      .update({ published_at: new Date().toISOString() })
      .eq('tenant_id', tenant!.id);
    await user.admin.from('tenants').update({ status: 'active' }).eq('id', tenant!.id);

    await page.goto(`/b/${user.slug}`);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('returns 404 for a suspended tenant', async ({ page }) => {
    user = await createProvisionedTestUser('nex050');
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    await user.admin
      .from('business_settings')
      .update({ published_at: new Date().toISOString() })
      .eq('tenant_id', tenant!.id);
    await user.admin.from('tenants').update({ status: 'suspended' }).eq('id', tenant!.id);

    const response = await page.goto(`/b/${user.slug}`);
    expect(response?.status()).toBe(404);
  });

  test('returns 404 for an active but unpublished tenant', async ({ page }) => {
    user = await createProvisionedTestUser('nex050');
    // provision_tenant_owner leaves status='setup' and published_at=null by default —
    // flip only status to active, published_at stays null (never published).
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    await user.admin.from('tenants').update({ status: 'active' }).eq('id', tenant!.id);

    const response = await page.goto(`/b/${user.slug}`);
    expect(response?.status()).toBe(404);
  });

  test('returns 404 for an unknown slug', async ({ page }) => {
    user = await createProvisionedTestUser('nex050');
    const response = await page.goto('/b/este-slug-nao-existe-de-todo');
    expect(response?.status()).toBe(404);
  });
});
