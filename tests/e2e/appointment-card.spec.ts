import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

// NEX-081 acceptance criteria: "Axe/mobile" — the appointment timeline card (horário,
// cliente, itens, uma ação contextual) rendered on /dashboard/agenda must be accessible
// and must not force horizontal overflow on a narrow viewport.
//
// Visual refinement mid-2026 (AppointmentCard.tsx) replaced the original card (which
// always showed both a total value + status text and both quick actions side by side)
// with a compact timeline row: total value and status text only render for inactive
// appointments (cancelled/completed/no_show — an active, upcoming one shows neither),
// and only ONE contextual action shows per row — "Abrir WhatsApp" while the appointment
// hasn't started yet, or the "Concluir" trigger once it's due (startAt <= now) — never
// both at once, since the completion form now lives in a separate bottom sheet
// (CompletionSheet.tsx) instead of expanding the card itself.
function bookingTokenHash(seed: string) {
  return seed.padEnd(64, '0').slice(0, 64);
}

async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

async function seedAppointment(
  user: ProvisionedTestUser,
  tenantId: string,
  { startsInFuture }: { startsInFuture: boolean },
) {
  const { data: client } = await user.admin
    .from('clients')
    .insert({ tenant_id: tenantId, name: 'Ana Cliente', phone_e164: '+351911111111' })
    .select('id')
    .single();

  const startAt = new Date(Date.now() + (startsInFuture ? 1 : -1) * 60 * 60_000);
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

  await user.admin.from('appointment_items').insert({
    tenant_id: tenantId,
    appointment_id: appointmentId,
    source_type: 'manual_extra',
    description: 'Verniz Gel',
    unit_price_cents: 2500,
    duration_minutes: 60,
  });
}

async function loginAndOpenAgenda(page: Page, user: ProvisionedTestUser) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(user.email);
  await page.getByLabel('Palavra-passe').fill(user.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto('/dashboard/agenda');
}

test.describe('appointment card (NEX-081)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.afterEach(async () => {
    if (user) await cleanupProvisionedTestUser(user);
  });

  test('shows time, client and items, with the WhatsApp action for an upcoming appointment', async ({
    page,
  }) => {
    user = await createProvisionedTestUser('nex081-upcoming');
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    await seedAppointment(user, tenant!.id, { startsInFuture: true });
    await loginAndOpenAgenda(page, user);

    const card = page.locator('.appointment-timeline-card').first();
    await expect(card).toBeVisible();
    await expect(card.getByText('Ana Cliente')).toBeVisible();
    await expect(card.getByText('Verniz Gel')).toBeVisible();

    await expect(card.getByRole('link', { name: 'Abrir WhatsApp' })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Concluir' })).toHaveCount(0);
  });

  test('shows the completion trigger instead of WhatsApp once the appointment is due', async ({
    page,
  }) => {
    user = await createProvisionedTestUser('nex081-due');
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    await seedAppointment(user, tenant!.id, { startsInFuture: false });
    await loginAndOpenAgenda(page, user);

    const card = page.locator('.appointment-timeline-card').first();
    await expect(card.getByRole('button', { name: 'Concluir' })).toBeVisible();
    await expect(card.getByRole('link', { name: 'Abrir WhatsApp' })).toHaveCount(0);
  });

  test('the "Abrir WhatsApp" link points to a wa.me deep link for the client', async ({ page }) => {
    user = await createProvisionedTestUser('nex081-whatsapp');
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    await seedAppointment(user, tenant!.id, { startsInFuture: true });
    await loginAndOpenAgenda(page, user);

    const card = page.locator('.appointment-timeline-card').first();
    const href = await card.getByRole('link', { name: 'Abrir WhatsApp' }).getAttribute('href');
    expect(href).toContain('https://wa.me/351911111111');
    expect(href).toContain('text=');
  });

  test('has no automatic accessibility violations', async ({ page }) => {
    user = await createProvisionedTestUser('nex081-axe');
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    await seedAppointment(user, tenant!.id, { startsInFuture: true });
    await loginAndOpenAgenda(page, user);

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('no horizontal overflow on a narrow viewport', async ({ page }) => {
    user = await createProvisionedTestUser('nex081-overflow');
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    await seedAppointment(user, tenant!.id, { startsInFuture: true });
    await loginAndOpenAgenda(page, user);

    await expectNoHorizontalOverflow(page);
  });
});
