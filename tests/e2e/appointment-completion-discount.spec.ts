import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

// NEX-112: "Descontos fixos/percentuais... motivo opcional, limites e total nunca
// negativo."
function bookingTokenHash(seed: string) {
  return seed.padEnd(64, '0').slice(0, 64);
}

async function seedAppointment(user: ProvisionedTestUser, tenantId: string) {
  const { data: client } = await user.admin
    .from('clients')
    .insert({ tenant_id: tenantId, name: 'Ana Cliente', phone_e164: '+351911111170' })
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
    expected_total_cents: 2500,
    booking_token_hash: bookingTokenHash(appointmentId),
  });

  return appointmentId;
}

test.describe('appointment completion discount (NEX-112)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.afterEach(async () => {
    if (user) await cleanupProvisionedTestUser(user);
  });

  test('applying a fixed discount with a reason recomputes the suggested total', async ({
    page,
  }) => {
    user = await createProvisionedTestUser('nex112-fixed');
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

    const card = page.locator('.appointment-card').first();
    await card.getByRole('button', { name: 'Concluir' }).click();
    await card.getByRole('button', { name: 'Ver mais' }).click();
    await card.getByLabel('Desconto').selectOption('fixed');
    await card.getByLabel('Valor (€)').fill('5.00');
    await card.getByLabel('Motivo (opcional)').fill('Cliente fiel');

    // 25.00 (expected) - 5.00 (discount) = 20.00.
    await expect(card.getByLabel('Valor final (€)')).toHaveValue('20.00');

    await card.getByRole('button', { name: 'Dinheiro' }).click();
    await card.getByRole('button', { name: 'Confirmar conclusão' }).click();
    await expect(card.getByText('Atendimento concluído.')).toBeVisible();

    const { data: appointment } = await user.admin
      .from('appointments')
      .select('final_total_cents')
      .eq('id', appointmentId)
      .single();
    expect(appointment?.final_total_cents).toBe(2000);

    const { data: item } = await user.admin
      .from('appointment_items')
      .select('description, unit_price_cents')
      .eq('appointment_id', appointmentId)
      .single();
    expect(item).toMatchObject({ description: 'Desconto — Cliente fiel', unit_price_cents: -500 });
  });

  test('applying a percent discount', async ({ page }) => {
    user = await createProvisionedTestUser('nex112-percent');
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

    const card = page.locator('.appointment-card').first();
    await card.getByRole('button', { name: 'Concluir' }).click();
    await card.getByRole('button', { name: 'Ver mais' }).click();
    await card.getByLabel('Desconto').selectOption('percent');
    await card.getByLabel('Percentagem (%)').fill('20');

    // 25.00 * 0.8 = 20.00.
    await expect(card.getByLabel('Valor final (€)')).toHaveValue('20.00');
  });

  test('shows a validation error for a percent discount above 100 and disables submit', async ({
    page,
  }) => {
    user = await createProvisionedTestUser('nex112-invalid');
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

    const card = page.locator('.appointment-card').first();
    await card.getByRole('button', { name: 'Concluir' }).click();
    await card.getByRole('button', { name: 'Ver mais' }).click();
    await card.getByLabel('Desconto').selectOption('percent');
    await card.getByLabel('Percentagem (%)').fill('150');
    await card.getByRole('button', { name: 'Dinheiro' }).click();

    await expect(card.getByText('O desconto percentual deve ser entre 0 e 100.')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Confirmar conclusão' })).toBeDisabled();
  });

  test('a discount larger than the total never produces a negative final value', async ({
    page,
  }) => {
    user = await createProvisionedTestUser('nex112-clamp');
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

    const card = page.locator('.appointment-card').first();
    await card.getByRole('button', { name: 'Concluir' }).click();
    await card.getByRole('button', { name: 'Ver mais' }).click();
    await card.getByLabel('Desconto').selectOption('fixed');
    await card.getByLabel('Valor (€)').fill('999');

    await expect(card.getByLabel('Valor final (€)')).toHaveValue('0.00');

    await card.getByRole('button', { name: 'Pendente' }).click();
    await card.getByRole('button', { name: 'Confirmar conclusão' }).click();
    await expect(card.getByText('Atendimento concluído.')).toBeVisible();

    const { data: appointment } = await user.admin
      .from('appointments')
      .select('final_total_cents')
      .eq('id', appointmentId)
      .single();
    expect(appointment?.final_total_cents).toBe(0);
  });
});
