import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

// NEX-110: "Valor final e cash/MBWAY/pending em poucos toques." Testes: "Axe, cêntimos,
// estados."
function bookingTokenHash(seed: string) {
  return seed.padEnd(64, '0').slice(0, 64);
}

async function seedAppointment(
  user: ProvisionedTestUser,
  tenantId: string,
  expectedTotalCents = 2500,
) {
  const { data: client } = await user.admin
    .from('clients')
    .insert({ tenant_id: tenantId, name: 'Ana Cliente', phone_e164: '+351911111150' })
    .select('id')
    .single();

  const startAt = new Date(Date.now() - 60 * 60_000);
  const endAt = new Date(startAt.getTime() + 60 * 60_000);
  const appointmentId = randomUUID();

  await user.admin.from('appointments').insert({
    id: appointmentId,
    tenant_id: tenantId,
    client_id: client!.id,
    source: 'admin',
    status: 'confirmed',
    start_at: startAt.toISOString(),
    end_at: endAt.toISOString(),
    blocked_until: new Date(endAt.getTime() + 15 * 60_000).toISOString(),
    expected_total_cents: expectedTotalCents,
    booking_token_hash: bookingTokenHash(appointmentId),
  });

  return appointmentId;
}

test.describe('appointment completion panel (NEX-110) @critical', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.afterEach(async () => {
    if (user) await cleanupProvisionedTestUser(user);
  });

  test('completes with cash payment using the pre-filled expected total', async ({ page }) => {
    user = await createProvisionedTestUser('nex110-cash');
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    const appointmentId = await seedAppointment(user, tenant!.id, 2500);

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/dashboard/agenda');

    // The completion form opens in a separate bottom sheet (CompletionSheet.tsx), not
    // inline inside the timeline card — CLAUDE.md's agenda redesign explicitly forbids
    // the card itself growing to show the form, so the trigger and the form live in two
    // different DOM subtrees.
    const card = page.locator('.appointment-timeline-card').first();
    await card.getByRole('button', { name: 'Concluir' }).click();
    const sheet = page.getByRole('dialog', { name: 'Concluir atendimento' });
    await expect(sheet.getByLabel('Valor final (€)')).toHaveValue('25.00');

    await sheet.getByRole('button', { name: 'Dinheiro' }).click();
    await sheet.getByRole('button', { name: 'Confirmar conclusão' }).click();
    // On success the panel returns null and the sheet's onCompleted closes it — there's
    // no inline "concluded" text anymore, the sheet disappearing is the success signal.
    await expect(sheet).toBeHidden();

    const { data: appointment } = await user.admin
      .from('appointments')
      .select('status, final_total_cents')
      .eq('id', appointmentId)
      .single();
    expect(appointment?.status).toBe('completed');
    expect(appointment?.final_total_cents).toBe(2500);

    const { data: payment } = await user.admin
      .from('payments')
      .select('method, status, amount_cents')
      .eq('appointment_id', appointmentId)
      .single();
    expect(payment).toMatchObject({ method: 'cash', status: 'paid', amount_cents: 2500 });
  });

  test('completes with an adjusted final value and MB WAY', async ({ page }) => {
    user = await createProvisionedTestUser('nex110-mbway');
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    const appointmentId = await seedAppointment(user, tenant!.id, 2500);

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/dashboard/agenda');

    const card = page.locator('.appointment-timeline-card').first();
    await card.getByRole('button', { name: 'Concluir' }).click();
    const sheet = page.getByRole('dialog', { name: 'Concluir atendimento' });
    await sheet.getByLabel('Valor final (€)').fill('32.50');
    await sheet.getByRole('button', { name: 'MB WAY' }).click();
    await sheet.getByRole('button', { name: 'Confirmar conclusão' }).click();
    await expect(sheet).toBeHidden();

    const { data: appointment } = await user.admin
      .from('appointments')
      .select('final_total_cents')
      .eq('id', appointmentId)
      .single();
    // 32.50 EUR -> 3250 cents, proving the euro-string-to-cents conversion is exact.
    expect(appointment?.final_total_cents).toBe(3250);
  });

  test('completes as pending with no payment method', async ({ page }) => {
    user = await createProvisionedTestUser('nex110-pending');
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    const appointmentId = await seedAppointment(user, tenant!.id);

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/dashboard/agenda');

    const card = page.locator('.appointment-timeline-card').first();
    await card.getByRole('button', { name: 'Concluir' }).click();
    const sheet = page.getByRole('dialog', { name: 'Concluir atendimento' });
    await sheet.getByRole('button', { name: 'Pendente' }).click();
    await sheet.getByRole('button', { name: 'Confirmar conclusão' }).click();
    await expect(sheet).toBeHidden();

    const { data: payment } = await user.admin
      .from('payments')
      .select('method, status')
      .eq('appointment_id', appointmentId)
      .single();
    expect(payment).toMatchObject({ method: null, status: 'pending' });
  });

  test('the confirm button stays disabled until a payment choice is made', async ({ page }) => {
    user = await createProvisionedTestUser('nex110-states');
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    await seedAppointment(user, tenant!.id);

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/dashboard/agenda');

    const card = page.locator('.appointment-timeline-card').first();
    await card.getByRole('button', { name: 'Concluir' }).click();
    const sheet = page.getByRole('dialog', { name: 'Concluir atendimento' });
    await expect(sheet.getByRole('button', { name: 'Confirmar conclusão' })).toBeDisabled();

    await sheet.getByRole('button', { name: 'Dinheiro' }).click();
    await expect(sheet.getByRole('button', { name: 'Confirmar conclusão' })).toBeEnabled();

    await sheet.getByRole('button', { name: 'Voltar' }).click();
    await expect(sheet).toBeHidden();
    await expect(card.getByRole('button', { name: 'Concluir' })).toBeVisible();
  });

  test('has no automatic accessibility violations with the panel open', async ({ page }) => {
    user = await createProvisionedTestUser('nex110-axe');
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    await seedAppointment(user, tenant!.id);

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/dashboard/agenda');

    const card = page.locator('.appointment-timeline-card').first();
    await card.getByRole('button', { name: 'Concluir' }).click();
    const sheet = page.getByRole('dialog', { name: 'Concluir atendimento' });
    await sheet.getByRole('button', { name: 'Dinheiro' }).click();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
