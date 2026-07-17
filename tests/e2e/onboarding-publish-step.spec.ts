import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';
import {
  completeBusinessStep,
  completeHoursStep,
  completeRulesStep,
  completeServicesStep,
} from './support/onboarding';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://127.0.0.1:3000';

function decodeQrDataUrl(dataUrl: string): string | null {
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  const png = PNG.sync.read(Buffer.from(base64, 'base64'));
  const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  return result?.data ?? null;
}

test.describe('onboarding publish step (NEX-035)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.beforeEach(async ({ page }) => {
    user = await createProvisionedTestUser('nex035');
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/onboarding');
    await completeBusinessStep(page);
    await completeHoursStep(page);
    await completeServicesStep(page);
    await completeRulesStep(page);
    await expect(page.getByText('Passo 5 de 5')).toBeVisible();
  });

  test.afterEach(async () => {
    await cleanupProvisionedTestUser(user);
  });

  test('has no automatic accessibility violations', async ({ page }) => {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('previews the public /b/{slug} link for the pre-filled slug', async ({ page }) => {
    await expect(page.getByText(`${appUrl}/b/${user.slug}`)).toBeVisible();
  });

  test('renders a QR code that decodes to the previewed public link', async ({ page }) => {
    const qrImage = page.getByAltText(`Código QR para ${appUrl}/b/${user.slug}`);
    await expect(qrImage).toBeVisible();
    const src = await qrImage.getAttribute('src');
    expect(src).toBeTruthy();
    expect(decodeQrDataUrl(src!)).toBe(`${appUrl}/b/${user.slug}`);
  });

  test('rejects a slug already used by another tenant with a friendly error', async ({ page }) => {
    const other = await createProvisionedTestUser('nex035-other');
    try {
      const slugInput = page.getByLabel('Link de marcação');
      await slugInput.fill(other.slug);
      await slugInput.blur();
      await page.getByRole('button', { name: 'Publicar' }).click();
      await expect(page.locator('[role="alert"].form-error')).toContainText('já está a ser usado');
      await expect(page).toHaveURL(/\/onboarding/);
    } finally {
      await cleanupProvisionedTestUser(other);
    }
  });

  test('publishing activates the tenant and redirects to the dashboard', async ({ page }) => {
    await page.getByRole('button', { name: 'Publicar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    const tenant = await user.admin
      .from('tenants')
      .select('id, status')
      .eq('slug', user.slug)
      .single();
    expect(tenant.data?.status).toBe('active');

    const settings = await user.admin
      .from('business_settings')
      .select('published_at')
      .eq('tenant_id', tenant.data!.id)
      .single();
    expect(settings.data?.published_at).not.toBeNull();
  });

  test('"Voltar" returns to step 4', async ({ page }) => {
    await page.getByRole('button', { name: 'Voltar' }).click();
    await expect(page.getByText('Passo 4 de 5')).toBeVisible();
  });
});
