import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

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

  test('renders public business info, address, contact, hours and quick actions for a published tenant', async ({
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
        specialty: 'Manicure e Nail Art',
        about_description: 'Especialista em nail art há mais de 10 anos.',
        instagram_handle: 'sofia.nails',
        booking_enabled: true,
        published_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenant!.id);
    await user.admin.from('tenants').update({ status: 'active' }).eq('id', tenant!.id);
    await user.admin.from('business_hours').insert({
      tenant_id: tenant!.id,
      day_of_week: 1,
      is_open: true,
      opens_at: '09:00',
      closes_at: '19:00',
    });
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

    // The business name (tenant.name), never the owner's own name, is the page's h1.
    await expect(page.getByRole('heading', { level: 1, name: 'E2E Test Salon' })).toBeVisible();
    await expect(page.getByText('Manicure e Nail Art')).toBeVisible();
    await expect(page.getByText('Sofia', { exact: true })).toBeVisible();
    await expect(page.getByText('Rua Exemplo, 10', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /\+351912345678/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'WhatsApp' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Instagram' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Ver horário completo/ })).toBeVisible();
    await expect(
      page.getByText('Especialista em nail art há mais de 10 anos.', { exact: true }),
    ).toBeVisible();

    // hasActiveCatalog + booking_enabled → the fixed CTA opens the real booking flow,
    // never an inline catalog on this page itself.
    await expect(page.getByRole('link', { name: 'Fazer marcação' })).toHaveAttribute(
      'href',
      `/b/${user.slug}/servicos`,
    );
  });

  test('shows a WhatsApp-only CTA when booking is temporarily disabled', async ({ page }) => {
    user = await createProvisionedTestUser('nex050');
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    await user.admin
      .from('business_settings')
      .update({
        phone_e164: '+351912345678',
        booking_enabled: false,
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

    await page.goto(`/b/${user.slug}`);
    await expect(page.getByRole('link', { name: 'Contactar profissional' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Fazer marcação' })).toHaveCount(0);
  });

  test('shows the unavailable-catalog message when the tenant has no active services or packages', async ({
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
      .update({ published_at: new Date().toISOString() })
      .eq('tenant_id', tenant!.id);
    await user.admin.from('tenants').update({ status: 'active' }).eq('id', tenant!.id);

    await page.goto(`/b/${user.slug}`);
    await expect(page.getByText('Os serviços estão a ser preparados.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Fazer marcação' })).toHaveCount(0);
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

  // NEX-166 (security review): /b/{slug}/dados was missing the published_at check its
  // sibling pages already had — regression test for that fix.
  test('/dados returns 404 for an active but unpublished tenant', async ({ page }) => {
    user = await createProvisionedTestUser('nex050');
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    await user.admin.from('tenants').update({ status: 'active' }).eq('id', tenant!.id);

    const response = await page.goto(`/b/${user.slug}/dados`);
    expect(response?.status()).toBe(404);
  });
});
