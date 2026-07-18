import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

// NEX-093 acceptance criteria: "XSS/log redaction" — a private note containing
// HTML/script-like content must render as inert text (React/JSX's default escaping),
// never execute, and the note must never be visible on another tenant's page.
test.describe('client private notes (NEX-093)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.afterEach(async () => {
    if (user) await cleanupProvisionedTestUser(user);
  });

  test('saves a note and re-renders HTML-like content as literal text, not executable markup', async ({
    page,
  }) => {
    user = await createProvisionedTestUser('nex093');
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    const { data: client } = await user.admin
      .from('clients')
      .insert({ tenant_id: tenant!.id, name: 'Ana Cliente', phone_e164: '+351911111111' })
      .select('id')
      .single();

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto(`/dashboard/clientes/${client!.id}`);

    let dialogFired = false;
    page.once('dialog', (dialog) => {
      dialogFired = true;
      void dialog.dismiss();
    });

    const maliciousNote = '<img src=x onerror="window.__xss=true">Alergia a látex';
    await page.getByLabel('Observações privadas').fill(maliciousNote);
    await page.getByRole('button', { name: 'Guardar observações' }).click();
    await expect(page.getByText('Observações guardadas.')).toBeVisible();

    await page.reload();
    // The saved value round-trips into the textarea as plain text — no dialog fired,
    // no injected global set, and the raw markup is visible as literal characters
    // rather than being parsed as an <img> tag.
    await expect(page.getByLabel('Observações privadas')).toHaveValue(maliciousNote);
    expect(dialogFired).toBe(false);
    const xssFired = await page.evaluate(() => (window as unknown as { __xss?: boolean }).__xss);
    expect(xssFired).toBeUndefined();
  });

  test("never shows another tenant's client private notes", async ({ page }) => {
    const owner = await createProvisionedTestUser('nex093-owner');
    const otherTenant = await createProvisionedTestUser('nex093-other');
    user = owner;

    try {
      const { data: otherTenantRow } = await otherTenant.admin
        .from('tenants')
        .select('id')
        .eq('slug', otherTenant.slug)
        .single();
      const { data: otherClient } = await otherTenant.admin
        .from('clients')
        .insert({
          tenant_id: otherTenantRow!.id,
          name: 'Cliente De Outro Tenant',
          phone_e164: '+351922222222',
          private_notes: 'Segredo de outro tenant',
        })
        .select('id')
        .single();

      await page.goto('/login');
      await page.getByLabel('E-mail').fill(owner.email);
      await page.getByLabel('Palavra-passe').fill(owner.password);
      await page.getByRole('button', { name: 'Entrar' }).click();
      await expect(page).toHaveURL(/\/dashboard/);

      const response = await page.goto(`/dashboard/clientes/${otherClient!.id}`);
      expect(response?.status()).toBe(404);
      await expect(page.getByText('Segredo de outro tenant')).toHaveCount(0);
    } finally {
      await cleanupProvisionedTestUser(otherTenant);
    }
  });
});
