import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

// NEX-143: "Confirmações e desfazer — ações destrutivas confirmam." This task's own
// required test category ("E2E"). Covers the two list-based "Remover" actions added in
// NEX-124/125 that had no confirm step until this task (AvailabilityBlocksManager,
// BusinessHoursExceptionsManager) — BusinessImageUpload got the identical fix but isn't
// covered here, since exercising it needs a real file upload fixture first, adding
// setup complexity beyond what's needed to prove the same two-step-reveal pattern this
// spec already exercises twice.
test.describe('definições — confirmação de ações destrutivas (NEX-143)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.beforeAll(async () => {
    user = await createProvisionedTestUser('nex143');
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
  });

  test('removing an availability block requires confirmation, and "Cancelar" keeps it', async ({
    page,
  }) => {
    await page.goto('/dashboard/definicoes/agenda');

    // Two "Data" fields exist on this page (block form + exception form below it) — this
    // is the first, the block-creation form's.
    const tomorrow = new Date(Date.now() + 24 * 60 * 60_000).toISOString().slice(0, 10);
    await page.getByLabel('Data', { exact: true }).first().fill(tomorrow);
    await page.getByLabel('Início').fill('14:00');
    await page.getByLabel('Fim').fill('16:00');
    await page.getByRole('button', { name: 'Criar bloqueio' }).click();

    const blockItem = page.locator('.public-service-item', { hasText: '14:00' });
    await expect(blockItem).toBeVisible();

    // First click only reveals the confirmation — nothing removed yet.
    await blockItem.getByRole('button', { name: 'Remover' }).click();
    await expect(blockItem.getByText('Remover este bloqueio?')).toBeVisible();
    await blockItem.getByRole('button', { name: 'Cancelar' }).click();
    await expect(blockItem).toBeVisible();
    await expect(blockItem.getByText('Remover este bloqueio?')).toBeHidden();

    // Confirming actually removes it.
    await blockItem.getByRole('button', { name: 'Remover' }).click();
    await blockItem.getByRole('button', { name: 'Sim, remover' }).click();
    await expect(blockItem).toBeHidden();
  });

  test('removing a business hours exception requires confirmation, and "Cancelar" keeps it', async ({
    page,
  }) => {
    await page.goto('/dashboard/definicoes/agenda');

    const dateKey = new Date(Date.now() + 2 * 24 * 60 * 60_000).toISOString().slice(0, 10);
    await page.getByLabel('Data', { exact: true }).nth(1).fill(dateKey);
    await page.getByLabel('Fechado').check();
    await page.getByRole('button', { name: 'Adicionar horário especial' }).click();

    const exceptionItem = page.locator('.public-service-item', { hasText: 'Fechado' });
    await expect(exceptionItem).toBeVisible();

    await exceptionItem.getByRole('button', { name: 'Remover' }).click();
    await expect(exceptionItem.getByText('Remover este horário especial?')).toBeVisible();
    await exceptionItem.getByRole('button', { name: 'Cancelar' }).click();
    await expect(exceptionItem).toBeVisible();

    await exceptionItem.getByRole('button', { name: 'Remover' }).click();
    await exceptionItem.getByRole('button', { name: 'Sim, remover' }).click();
    await expect(exceptionItem).toBeHidden();
  });
});
