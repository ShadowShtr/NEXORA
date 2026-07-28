import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
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

  // Two constraints the appointment's start time must satisfy, at any hour the test
  // happens to run: (1) it must fall on "today" in Europe/Lisbon — the agenda page
  // filters by that (business_settings.timezone), and a fixed UTC offset lands on the
  // wrong day whenever UTC and Lisboa disagree on the calendar date (the ~23:00-24:00
  // UTC window every day, WEST = UTC+1); (2) it must already be in the past — the
  // "Concluir" trigger only renders once `nowMs >= startAtMs` (AppointmentCard.tsx), so
  // anchoring to a fixed clock time like noon fails whenever the test runs before noon.
  // "1 minute after Lisboa midnight today" satisfies both: always today in Lisboa, and
  // always in the past by the time this line runs (the only instant it wouldn't be is
  // the single minute right at midnight itself).
  const lisbonTodayKey = formatInTimeZone(new Date(), 'Europe/Lisbon', 'yyyy-MM-dd');
  const startAt = new Date(fromZonedTime(`${lisbonTodayKey}T00:01:00`, 'Europe/Lisbon'));
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

    const card = page.locator('.appointment-timeline-card').first();
    await card.getByRole('button', { name: /^Concluir/ }).click();

    // CompletionSheet.tsx: a fixed bottom sheet (role="dialog"), not inline on the card
    // — the completion form lives here, scoped by page, not by the timeline card.
    const sheet = page.getByRole('dialog', { name: /^Concluir atendimento/ });
    await expect(sheet.getByLabel('Valor final (€)')).toHaveValue('25.00');

    await sheet.getByRole('button', { name: 'Dinheiro' }).click();
    await sheet.getByRole('button', { name: 'Confirmar conclusão' }).click();
    // AppointmentCompletionPanel.tsx: on success the form unmounts (returns null) and
    // calls onCompleted -> CompletionSheet's onClose -> the whole dialog closes. There
    // is no success message rendered; the sheet disappearing is the success signal.
    await expect(sheet).not.toBeVisible();

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
    await card.getByRole('button', { name: /^Concluir/ }).click();

    const sheet = page.getByRole('dialog', { name: /^Concluir atendimento/ });
    await sheet.getByLabel('Valor final (€)').fill('32.50');
    await sheet.getByRole('button', { name: 'MB WAY' }).click();
    await sheet.getByRole('button', { name: 'Confirmar conclusão' }).click();
    await expect(sheet).not.toBeVisible();

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
    await card.getByRole('button', { name: /^Concluir/ }).click();

    const sheet = page.getByRole('dialog', { name: /^Concluir atendimento/ });
    await sheet.getByRole('button', { name: 'Pendente' }).click();
    await sheet.getByRole('button', { name: 'Confirmar conclusão' }).click();
    await expect(sheet).not.toBeVisible();

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
    await card.getByRole('button', { name: /^Concluir/ }).click();

    const sheet = page.getByRole('dialog', { name: /^Concluir atendimento/ });
    await expect(sheet.getByRole('button', { name: 'Confirmar conclusão' })).toBeDisabled();

    await sheet.getByRole('button', { name: 'Dinheiro' }).click();
    await expect(sheet.getByRole('button', { name: 'Confirmar conclusão' })).toBeEnabled();

    await sheet.getByRole('button', { name: 'Voltar' }).click();
    await expect(sheet).not.toBeVisible();
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
    await card.getByRole('button', { name: /^Concluir/ }).click();

    const sheet = page.getByRole('dialog', { name: /^Concluir atendimento/ });
    await sheet.getByRole('button', { name: 'Dinheiro' }).click();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
