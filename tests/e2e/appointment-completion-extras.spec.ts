import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

// NEX-111: "Ver mais... serviço existente ou ajuste manual."
function bookingTokenHash(seed: string) {
  return seed.padEnd(64, '0').slice(0, 64);
}

async function seedAppointmentAndCatalog(user: ProvisionedTestUser, tenantId: string) {
  const { data: client } = await user.admin
    .from('clients')
    .insert({ tenant_id: tenantId, name: 'Ana Cliente', phone_e164: '+351911111160' })
    .select('id')
    .single();

  const { data: category } = await user.admin
    .from('service_categories')
    .insert({ tenant_id: tenantId, name: 'Unhas', sort_order: 0 })
    .select('id')
    .single();

  await user.admin.from('services').insert({
    tenant_id: tenantId,
    category_id: category!.id,
    name: 'Verniz Gel',
    price_cents: 1500,
    duration_minutes: 30,
    is_active: true,
  });

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

test.describe('appointment completion extras (NEX-111)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.afterEach(async () => {
    if (user) await cleanupProvisionedTestUser(user);
  });

  test('adding a catalog service extra recomputes the suggested final total', async ({ page }) => {
    user = await createProvisionedTestUser('nex111-service');
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    const appointmentId = await seedAppointmentAndCatalog(user, tenant!.id);

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/dashboard/agenda');

    const card = page.locator('.appointment-card').first();
    await card.getByRole('button', { name: 'Concluir' }).click();
    await card.getByRole('button', { name: 'Ver mais' }).click();
    await card.getByLabel('Adicionar serviço').selectOption({ label: 'Verniz Gel (15,00 €)' });

    // 25.00 (expected) + 15.00 (extra) = 40.00, auto-suggested since the owner hasn't
    // typed into the value field herself.
    await expect(card.getByLabel('Valor final (€)')).toHaveValue('40.00');

    await card.getByRole('button', { name: 'Dinheiro' }).click();
    await card.getByRole('button', { name: 'Confirmar conclusão' }).click();
    await expect(card.getByText('Atendimento concluído.')).toBeVisible();

    const { data: appointment } = await user.admin
      .from('appointments')
      .select('final_total_cents')
      .eq('id', appointmentId)
      .single();
    expect(appointment?.final_total_cents).toBe(4000);

    const { data: items } = await user.admin
      .from('appointment_items')
      .select('source_type, description, unit_price_cents')
      .eq('appointment_id', appointmentId);
    expect(items).toEqual([
      { source_type: 'service', description: 'Verniz Gel', unit_price_cents: 1500 },
    ]);
  });

  test('a manually edited value is never overwritten by adding an extra', async ({ page }) => {
    user = await createProvisionedTestUser('nex111-manual-wins');
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    await seedAppointmentAndCatalog(user, tenant!.id);

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/dashboard/agenda');

    const card = page.locator('.appointment-card').first();
    await card.getByRole('button', { name: 'Concluir' }).click();
    await card.getByLabel('Valor final (€)').fill('99.00');
    await card.getByRole('button', { name: 'Ver mais' }).click();
    await card.getByLabel('Adicionar serviço').selectOption({ label: 'Verniz Gel (15,00 €)' });

    // Owner already typed her own value — it must survive the extra being added.
    await expect(card.getByLabel('Valor final (€)')).toHaveValue('99');
  });

  test('adding and removing a manual extra', async ({ page }) => {
    user = await createProvisionedTestUser('nex111-manual-extra');
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    const appointmentId = await seedAppointmentAndCatalog(user, tenant!.id);

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/dashboard/agenda');

    const card = page.locator('.appointment-card').first();
    await card.getByRole('button', { name: 'Concluir' }).click();
    await card.getByRole('button', { name: 'Ver mais' }).click();
    await card.getByLabel('Ajuste manual — descrição').fill('Correção de unha');
    await card.getByLabel('Valor (€)').fill('5.00');
    await card.getByRole('button', { name: 'Adicionar' }).click();

    await expect(card.getByText('Correção de unha')).toBeVisible();
    await expect(card.getByLabel('Valor final (€)')).toHaveValue('30.00');

    await card.getByRole('button', { name: 'Remover Correção de unha' }).click();
    await expect(card.getByText('Correção de unha')).toHaveCount(0);
    await expect(card.getByLabel('Valor final (€)')).toHaveValue('25.00');

    await card.getByRole('button', { name: 'Pendente' }).click();
    await card.getByRole('button', { name: 'Confirmar conclusão' }).click();
    await expect(card.getByText('Atendimento concluído.')).toBeVisible();

    const { data: items } = await user.admin
      .from('appointment_items')
      .select('id')
      .eq('appointment_id', appointmentId);
    expect(items).toHaveLength(0);
  });
});
