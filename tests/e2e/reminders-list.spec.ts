import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

// NEX-101: "Pendentes, overdue e concluídos com badges." Skipped reminders (from a
// cancelled/no_show appointment, NEX-100) are excluded — there is nothing left to act
// on for those.
function bookingTokenHash(seed: string) {
  return seed.padEnd(64, '0').slice(0, 64);
}

async function seedAppointmentWithReminder(
  user: ProvisionedTestUser,
  tenantId: string,
  clientId: string,
  startAt: Date,
  reminderStatus: 'pending' | 'opened' | 'marked_sent' | 'skipped',
  dueAt: Date,
) {
  const endAt = new Date(startAt.getTime() + 60 * 60_000);
  const appointmentId = randomUUID();
  await user.admin.from('appointments').insert({
    id: appointmentId,
    tenant_id: tenantId,
    client_id: clientId,
    source: 'admin',
    status: 'confirmed',
    start_at: startAt.toISOString(),
    end_at: endAt.toISOString(),
    blocked_until: new Date(endAt.getTime() + 15 * 60_000).toISOString(),
    expected_total_cents: 2500,
    booking_token_hash: bookingTokenHash(appointmentId),
  });
  await user.admin.from('reminders').insert({
    tenant_id: tenantId,
    appointment_id: appointmentId,
    due_at: dueAt.toISOString(),
    status: reminderStatus,
  });
  return appointmentId;
}

test.describe('reminders list (NEX-101)', () => {
  test.skip(!canUseSupabase(), 'Requires Supabase credentials');

  let user: ProvisionedTestUser;

  test.afterEach(async () => {
    if (user) await cleanupProvisionedTestUser(user);
  });

  test('shows an empty state with no reminders yet', async ({ page }) => {
    user = await createProvisionedTestUser('nex101-empty');

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/dashboard/lembretes');
    await expect(page.getByText('Sem lembretes pendentes.')).toBeVisible();
  });

  test('shows pending, overdue and marked_sent reminders with the right badges, excluding skipped', async ({
    page,
  }) => {
    user = await createProvisionedTestUser('nex101');
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    const { data: client } = await user.admin
      .from('clients')
      .insert({ tenant_id: tenant!.id, name: 'Cliente Pendente', phone_e164: '+351911111120' })
      .select('id')
      .single();

    await seedAppointmentWithReminder(
      user,
      tenant!.id,
      client!.id,
      new Date(Date.now() + 48 * 60 * 60_000),
      'pending',
      new Date(Date.now() + 24 * 60 * 60_000),
    );
    await seedAppointmentWithReminder(
      user,
      tenant!.id,
      client!.id,
      new Date(Date.now() + 2 * 60 * 60_000),
      'pending',
      new Date(Date.now() - 60 * 60_000),
    );
    await seedAppointmentWithReminder(
      user,
      tenant!.id,
      client!.id,
      new Date(Date.now() + 50 * 60 * 60_000),
      'marked_sent',
      new Date(Date.now() + 26 * 60 * 60_000),
    );
    await seedAppointmentWithReminder(
      user,
      tenant!.id,
      client!.id,
      new Date(Date.now() + 52 * 60 * 60_000),
      'skipped',
      new Date(Date.now() + 28 * 60 * 60_000),
    );

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/dashboard/lembretes');
    await expect(page.getByText('Pendente')).toBeVisible();
    await expect(page.getByText('Atrasado')).toBeVisible();
    await expect(page.getByText('Enviado')).toBeVisible();
    // 3 visible cards (pending + overdue + marked_sent), skipped excluded.
    await expect(page.locator('.appointment-card')).toHaveCount(3);
  });
});
