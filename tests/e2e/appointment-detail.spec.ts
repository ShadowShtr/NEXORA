import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

// NEX-084: "Detalhes, cancelar e reagendar" with "confirmação" — the two-step reveal
// (click once to show the real action, click again to commit) rather than a native
// window.confirm().
function bookingTokenHash(seed: string) {
  return seed.padEnd(64, '0').slice(0, 64);
}

async function seedAppointment(user: ProvisionedTestUser, tenantId: string, startAt: Date) {
  const { data: client } = await user.admin
    .from('clients')
    .insert({ tenant_id: tenantId, name: 'Ana Cliente', phone_e164: '+351911111111' })
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

  return appointmentId;
}

test.describe('appointment detail page (NEX-084)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.afterEach(async () => {
    if (user) await cleanupProvisionedTestUser(user);
  });

  test('cancelling requires a second confirming click, then updates the status', async ({
    page,
  }) => {
    user = await createProvisionedTestUser('nex084');
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    const appointmentId = await seedAppointment(
      user,
      tenant!.id,
      new Date(Date.now() + 24 * 60 * 60_000),
    );

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto(`/dashboard/agenda/${appointmentId}`);
    await expect(page.getByText('Ana Cliente')).toBeVisible();
    await expect(page.getByText('Verniz Gel')).toBeVisible();

    // Danger zone is collapsed by default (details/summary) — open it first.
    await page.getByText('Ações delicadas').click();
    await page.getByRole('button', { name: 'Cancelar marcação' }).click();
    // First click only reveals the confirmation, does not cancel yet.
    await expect(page.getByText('Cancelar esta marcação?')).toBeVisible();

    // The confirm button reuses the same label as the trigger (spec), but the trigger
    // has already unmounted by now — this resolves to the one real button on screen.
    await page.getByRole('button', { name: 'Cancelar marcação' }).click();
    await expect(page.getByText('Marcação cancelada.')).toBeVisible();

    const { data: appointment } = await user.admin
      .from('appointments')
      .select('status')
      .eq('id', appointmentId)
      .single();
    expect(appointment?.status).toBe('cancelled');
  });

  test('rescheduling picks a real available slot and updates start_at', async ({ page }) => {
    user = await createProvisionedTestUser('nex084-reschedule');
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    // Reagendar now picks from real computed availability (AvailabilityCalendar) instead
    // of a blind date/time input — needs actual open business_hours to have anything to
    // offer (provision_tenant_owner doesn't create any by default).
    await user.admin.from('business_hours').insert(
      Array.from({ length: 7 }, (_, dayOfWeek) => ({
        tenant_id: tenant!.id,
        day_of_week: dayOfWeek,
        is_open: true,
        opens_at: '00:00',
        closes_at: '23:30',
      })),
    );
    const originalStart = new Date(Date.now() + 24 * 60 * 60_000);
    const appointmentId = await seedAppointment(user, tenant!.id, originalStart);

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto(`/dashboard/agenda/${appointmentId}`);
    await page.getByRole('button', { name: 'Reagendar' }).click();

    const firstSlot = page.locator('.public-slot-list .public-slot-button').first();
    await firstSlot.waitFor({ state: 'visible', timeout: 15_000 });
    await firstSlot.click();
    await page.getByRole('button', { name: 'Confirmar novo horário' }).click();

    await expect(page.getByText('Marcação reagendada.')).toBeVisible();

    const { data: appointment } = await user.admin
      .from('appointments')
      .select('start_at')
      .eq('id', appointmentId)
      .single();
    // The picked slot came from the server's own availability computation, not test-side
    // date arithmetic — the only thing worth asserting here is that start_at genuinely
    // moved away from the original seeded instant.
    expect(new Date(appointment!.start_at).getTime()).not.toBe(originalStart.getTime());
  });

  // NEX-095: "Registar" falta — mirrors the cancel test's two-step confirm pattern.
  test('marking a no-show requires a second confirming click, then updates the status', async ({
    page,
  }) => {
    user = await createProvisionedTestUser('nex095');
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    const appointmentId = await seedAppointment(
      user,
      tenant!.id,
      new Date(Date.now() - 24 * 60 * 60_000),
    );

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto(`/dashboard/agenda/${appointmentId}`);
    // Danger zone is collapsed by default (details/summary) — open it first.
    await page.getByText('Ações delicadas').click();
    await page.getByRole('button', { name: 'Marcar falta' }).click();
    await expect(page.getByText('Marcar esta cliente como falta?')).toBeVisible();

    // The confirm button reuses the same label as the trigger (spec), but the trigger
    // has already unmounted by now — this resolves to the one real button on screen.
    await page.getByRole('button', { name: 'Marcar falta' }).click();
    await expect(page.getByText('Falta registada.')).toBeVisible();

    const { data: appointment } = await user.admin
      .from('appointments')
      .select('status')
      .eq('id', appointmentId)
      .single();
    expect(appointment?.status).toBe('no_show');
  });
});
