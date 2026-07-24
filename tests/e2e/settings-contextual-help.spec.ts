import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

// NEX-144: "Ajuda contextual curta — explicação sob demanda, sem tour obrigatório."
// Covers the 5 HelpTip icons added to BookingRulesForm's technical labels: hidden by
// default (no forced tour), toggled open/closed on click, and — the actual regression
// this component guards against — a click on the "?" inside a <label> must not also
// forward a click to the <select> it labels (label-forwarding footgun, see HelpTip.tsx).
test.describe('definições — ajuda contextual (NEX-144)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.beforeAll(async () => {
    user = await createProvisionedTestUser('nex144');
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

  test('help text is hidden until requested, and toggles without opening the select', async ({
    page,
  }) => {
    await page.goto('/dashboard/definicoes/marcacoes');

    const helpButton = page.getByRole('button', { name: 'O que é o intervalo entre clientes?' });
    const select = page.locator('select[name="bufferMinutes"]');

    await expect(page.getByText('Tempo livre reservado automaticamente')).toBeHidden();

    await helpButton.click();
    await expect(page.getByText('Tempo livre reservado automaticamente')).toBeVisible();
    // The click landed on the "?" button, inside the same <label> as the select — it
    // must not also have forwarded a click to (and opened/changed) the select.
    await expect(select).not.toBeFocused();

    await helpButton.click();
    await expect(page.getByText('Tempo livre reservado automaticamente')).toBeHidden();
  });

  test('all five booking-rule fields expose contextual help', async ({ page }) => {
    await page.goto('/dashboard/definicoes/marcacoes');

    const labels = [
      'O que é o intervalo da agenda?',
      'O que é o intervalo entre clientes?',
      'O que é a antecedência mínima para marcar?',
      'O que é a janela de marcação no futuro?',
      'O que é o aviso mínimo para cancelar?',
    ];

    for (const label of labels) {
      await expect(page.getByRole('button', { name: label })).toBeVisible();
    }
  });
});
