import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

// NEX-104: "Placeholders allowlisted e preview."
test.describe('reminder template settings (NEX-104)', () => {
  test.skip(!canUseSupabase(), 'Requires Supabase credentials');

  let user: ProvisionedTestUser;

  test.afterEach(async () => {
    if (user) await cleanupProvisionedTestUser(user);
  });

  test('shows a live preview as the owner types', async ({ page }) => {
    user = await createProvisionedTestUser('nex104-preview');

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/dashboard/definicoes');
    const textarea = page.getByLabel('Mensagem do lembrete');
    await textarea.fill('Oi {{cliente}}, até {{data}} às {{hora}}!');
    await expect(page.getByText('Oi Ana, até amanhã às 14:30!')).toBeVisible();
  });

  test('saves a valid custom template', async ({ page }) => {
    user = await createProvisionedTestUser('nex104-save');
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/dashboard/definicoes');
    await page.getByLabel('Mensagem do lembrete').fill('Olá {{cliente}}! Não faltes {{data}}.');
    await page.getByRole('button', { name: 'Guardar mensagem' }).click();
    await expect(page.getByText('Mensagem guardada.')).toBeVisible();

    const { data: settings } = await user.admin
      .from('business_settings')
      .select('reminder_message_template')
      .eq('tenant_id', tenant!.id)
      .single();
    expect(settings?.reminder_message_template).toBe('Olá {{cliente}}! Não faltes {{data}}.');
  });

  test('rejects a template with a disallowed placeholder', async ({ page }) => {
    user = await createProvisionedTestUser('nex104-reject');

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/dashboard/definicoes');
    await page.getByLabel('Mensagem do lembrete').fill('Código: {{promo}}');
    await page.getByRole('button', { name: 'Guardar mensagem' }).click();
    await expect(page.getByText(/Placeholder não permitido/)).toBeVisible();
  });
});
