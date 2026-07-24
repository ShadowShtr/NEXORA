import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

// NEX-141: "Defaults e 'usar recomendações'" — this task's own required test category
// ("Reset/undo"). provision_tenant_owner already seeds business_settings with the
// recommended values (they're the column defaults, domain/rules-step.ts), so the test
// first changes a value away from the default before resetting — otherwise "usar
// recomendações" would be a no-op and wouldn't actually prove anything.
test.describe('regras da agenda — reset e desfazer (NEX-141)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.beforeAll(async () => {
    user = await createProvisionedTestUser('nex141');
  });

  test.afterAll(async () => {
    await cleanupProvisionedTestUser(user);
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/dashboard/definicoes/marcacoes');
  });

  test('"Usar recomendações" resets away from a manual change, and "Desfazer" undoes it before saving', async ({
    page,
  }) => {
    const slotSelect = page.getByLabel('Intervalo da agenda');
    await expect(slotSelect).toHaveValue('30'); // recommended default, freshly provisioned

    await slotSelect.selectOption('60');
    await expect(slotSelect).toHaveValue('60');
    await expect(page.getByRole('button', { name: 'Desfazer' })).toBeHidden();

    await page.getByRole('button', { name: 'Usar recomendações' }).click();
    await expect(slotSelect).toHaveValue('30');

    await page.getByRole('button', { name: 'Desfazer' }).click();
    await expect(slotSelect).toHaveValue('60');
    await expect(page.getByRole('button', { name: 'Desfazer' })).toBeHidden();
  });

  test('"Guardar" persists the selected rules across a reload', async ({ page }) => {
    await page.getByLabel('Intervalo da agenda').selectOption('60');
    await page.getByLabel('Aviso mínimo para cancelar').selectOption('48');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('status')).toHaveText('Guardado.');

    await page.reload();
    await expect(page.getByLabel('Intervalo da agenda')).toHaveValue('60');
    await expect(page.getByLabel('Aviso mínimo para cancelar')).toHaveValue('48');
  });
});
