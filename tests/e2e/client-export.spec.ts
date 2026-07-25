import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

// NEX-162: "Exportar dados da cliente — export tenant-scoped e minimizado", required
// test category "Authorization/privacy". Covers exactly the failure modes an export
// endpoint must never allow: an unauthenticated caller, and a caller authenticated as
// a *different* tenant trying to export a client that isn't theirs.
test.describe('exportar dados da cliente (NEX-162)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let owner: ProvisionedTestUser;
  let otherTenant: ProvisionedTestUser;
  let clientId: string;

  test.beforeAll(async () => {
    owner = await createProvisionedTestUser('nex162a');
    otherTenant = await createProvisionedTestUser('nex162b');

    const { data: profile } = await owner.admin
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', owner.userId)
      .single();

    const { data: client } = await owner.admin
      .from('clients')
      .insert({
        tenant_id: profile!.tenant_id,
        name: 'Cliente Export Test',
        phone_e164: '+351911112222',
        email: 'cliente-export@example.test',
      })
      .select('id')
      .single();
    clientId = client!.id;
  });

  test.afterAll(async () => {
    await owner.admin.from('clients').delete().eq('id', clientId);
    await cleanupProvisionedTestUser(owner);
    await cleanupProvisionedTestUser(otherTenant);
  });

  test('redirects an unauthenticated request to login', async ({ page }) => {
    const response = await page.goto(`/api/clientes/${clientId}/export`);
    expect(response?.url()).toContain('/login');
  });

  test('another tenant cannot export a client that is not theirs (404)', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(otherTenant.email);
    await page.getByLabel('Palavra-passe').fill(otherTenant.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    const response = await page.request.get(`/api/clientes/${clientId}/export`);
    expect(response.status()).toBe(404);
  });

  test('the owning tenant can export the client as minimized, structured JSON', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(owner.email);
    await page.getByLabel('Palavra-passe').fill(owner.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    const response = await page.request.get(`/api/clientes/${clientId}/export`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-disposition']).toContain('attachment');
    expect(response.headers()['cache-control']).toBe('no-store');

    const body = await response.json();
    expect(body.client.name).toBe('Cliente Export Test');
    expect(body.client.phone).toBe('+351911112222');
    // Minimized: no internal ids, tenant_id, or storage paths leak into the export.
    expect(body).not.toHaveProperty('id');
    expect(body.client).not.toHaveProperty('id');
    expect(body.client).not.toHaveProperty('tenant_id');
  });

  test('client detail page links to the export endpoint', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(owner.email);
    await page.getByLabel('Palavra-passe').fill(owner.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto(`/dashboard/clientes/${clientId}`);
    await expect(page.getByRole('link', { name: 'Exportar dados desta cliente' })).toHaveAttribute(
      'href',
      `/api/clientes/${clientId}/export`,
    );
  });
});
