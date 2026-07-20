import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

// NEX-082 acceptance criteria: "E2E datas e DST" — navigating day/week/month views and
// across a DST transition must show the right appointments in the right place.
function bookingTokenHash(seed: string) {
  return seed.padEnd(64, '0').slice(0, 64);
}

async function seedAppointment(user: ProvisionedTestUser, tenantId: string, startAt: Date) {
  const { data: client } = await user.admin
    .from('clients')
    .insert({
      tenant_id: tenantId,
      name: 'Ana Cliente',
      phone_e164: `+3519${Math.floor(10000000 + Math.random() * 89999999)}`,
    })
    .select('id')
    .single();

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

test.describe('agenda calendar views (NEX-082)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.afterEach(async () => {
    if (user) await cleanupProvisionedTestUser(user);
  });

  test("switching to week/month view still shows today's appointment, and navigating away hides it", async ({
    page,
  }) => {
    user = await createProvisionedTestUser('nex082');
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    await seedAppointment(user, tenant!.id, new Date(Date.now() + 60 * 60_000));

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/dashboard/agenda');

    await expect(page.getByText('Ana Cliente')).toBeVisible();

    await page.getByRole('link', { name: 'Semana' }).click();
    await expect(page.getByText('Ana Cliente')).toBeVisible();

    await page.getByRole('link', { name: 'Mês' }).click();
    await expect(page.getByText('Ana Cliente')).toBeVisible();

    // Navigating a full month forward must no longer show today's appointment.
    await page.getByRole('link', { name: 'Seguinte' }).click();
    await expect(page.getByText('Ana Cliente')).toHaveCount(0);

    // "Hoje" brings it back.
    await page.getByRole('link', { name: 'Hoje' }).click();
    await expect(page.getByText('Ana Cliente')).toBeVisible();
  });

  test("day view navigation across the spring-forward DST date (2026-03-29) shows the right day's appointment", async ({
    page,
  }) => {
    user = await createProvisionedTestUser('nex082-dst');
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();

    // 2026-03-29 09:00 WEST (UTC+1, after the spring-forward transition) = 08:00 UTC.
    await seedAppointment(user, tenant!.id, new Date('2026-03-29T08:00:00.000Z'));

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/dashboard/agenda?view=day&date=2026-03-28');
    await expect(page.getByText('Ana Cliente')).toHaveCount(0);

    await page.getByRole('link', { name: 'Seguinte' }).click();
    await expect(page).toHaveURL(/date=2026-03-29/);
    await expect(page.getByText('Ana Cliente')).toBeVisible();
    await expect(page.getByText('09:00')).toBeVisible();

    await page.getByRole('link', { name: 'Seguinte' }).click();
    await expect(page).toHaveURL(/date=2026-03-30/);
    await expect(page.getByText('Ana Cliente')).toHaveCount(0);
  });
});
