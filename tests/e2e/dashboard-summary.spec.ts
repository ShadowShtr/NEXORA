import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

// NEX-080 acceptance criteria: "Queries tenant-scoped e timezone" — the dashboard's
// four cards must reflect only the signed-in owner's own tenant data, computed for
// "today" in the tenant's own timezone (Europe/Lisbon by default), not UTC's calendar
// day or another tenant's appointments.
function bookingTokenHash(seed: string) {
  return seed.padEnd(64, '0').slice(0, 64);
}

async function seedAppointment(
  user: ProvisionedTestUser,
  tenantId: string,
  opts: { clientName: string; serviceName: string; startAt: Date; durationMinutes: number },
) {
  const { data: category } = await user.admin
    .from('service_categories')
    .insert({ tenant_id: tenantId, name: 'Manicure' })
    .select('id')
    .maybeSingle();

  const categoryId =
    category?.id ??
    (
      await user.admin
        .from('service_categories')
        .select('id')
        .eq('tenant_id', tenantId)
        .limit(1)
        .single()
    ).data!.id;

  const { data: client } = await user.admin
    .from('clients')
    .insert({
      tenant_id: tenantId,
      name: opts.clientName,
      phone_e164: `+3519${Math.floor(10000000 + Math.random() * 89999999)}`,
    })
    .select('id')
    .single();

  const endAt = new Date(opts.startAt.getTime() + opts.durationMinutes * 60_000);
  const blockedUntil = new Date(endAt.getTime() + 15 * 60_000);
  const appointmentId = randomUUID();

  await user.admin.from('appointments').insert({
    id: appointmentId,
    tenant_id: tenantId,
    client_id: client!.id,
    source: 'admin',
    status: 'confirmed',
    start_at: opts.startAt.toISOString(),
    end_at: endAt.toISOString(),
    blocked_until: blockedUntil.toISOString(),
    expected_total_cents: 2500,
    booking_token_hash: bookingTokenHash(appointmentId),
  });

  await user.admin.from('appointment_items').insert({
    tenant_id: tenantId,
    appointment_id: appointmentId,
    source_type: 'manual_extra',
    description: opts.serviceName,
    unit_price_cents: 2500,
    duration_minutes: opts.durationMinutes,
  });

  return { categoryId, appointmentId };
}

test.describe('dashboard summary (NEX-080)', () => {
  let owner: ProvisionedTestUser;
  let otherTenant: ProvisionedTestUser;

  test.afterEach(async () => {
    if (owner) await cleanupProvisionedTestUser(owner);
    if (otherTenant) await cleanupProvisionedTestUser(otherTenant);
  });

  test("shows only the signed-in tenant's next appointment and today count, not another tenant's", async ({
    page,
  }) => {
    test.skip(!canUseSupabase(), 'Requires Supabase credentials');
    owner = await createProvisionedTestUser('nex080');
    otherTenant = await createProvisionedTestUser('nex080-other');

    const { data: tenant } = await owner.admin
      .from('tenants')
      .select('id')
      .eq('slug', owner.slug)
      .single();
    const { data: otherTenantRow } = await otherTenant.admin
      .from('tenants')
      .select('id')
      .eq('slug', otherTenant.slug)
      .single();

    // An appointment 2h from now, in the owner's own tenant — this must show as "next".
    const soon = new Date(Date.now() + 2 * 60 * 60_000);
    await seedAppointment(owner, tenant!.id, {
      clientName: 'Ana Cliente',
      serviceName: 'Verniz Gel',
      startAt: soon,
      durationMinutes: 60,
    });

    // Same time, a different tenant — must never appear on the owner's dashboard.
    await seedAppointment(otherTenant, otherTenantRow!.id, {
      clientName: 'Outra Cliente De Outro Tenant',
      serviceName: 'Outro Serviço',
      startAt: soon,
      durationMinutes: 60,
    });

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(owner.email);
    await page.getByLabel('Palavra-passe').fill(owner.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await expect(page.getByText('Ana Cliente')).toBeVisible();
    await expect(page.getByText('Verniz Gel')).toBeVisible();
    await expect(page.getByText('1 hoje')).toBeVisible();

    // Never leaks the other tenant's data onto this page.
    await expect(page.getByText('Outra Cliente De Outro Tenant')).toHaveCount(0);
    await expect(page.getByText('Outro Serviço')).toHaveCount(0);
  });

  test('shows "Nenhuma marcação." when there is no upcoming appointment today', async ({
    page,
  }) => {
    test.skip(!canUseSupabase(), 'Requires Supabase credentials');
    owner = await createProvisionedTestUser('nex080-empty');

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(owner.email);
    await page.getByLabel('Palavra-passe').fill(owner.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await expect(page.getByText('Nenhuma marcação.')).toBeVisible();
    await expect(page.getByText('0 hoje')).toBeVisible();
  });

  test('excludes a cancelled appointment from the "next" card and today count', async ({
    page,
  }) => {
    test.skip(!canUseSupabase(), 'Requires Supabase credentials');
    owner = await createProvisionedTestUser('nex080-cancelled');

    const { data: tenant } = await owner.admin
      .from('tenants')
      .select('id')
      .eq('slug', owner.slug)
      .single();

    const soon = new Date(Date.now() + 2 * 60 * 60_000);
    const { appointmentId } = await seedAppointment(owner, tenant!.id, {
      clientName: 'Cliente Cancelada',
      serviceName: 'Verniz Gel',
      startAt: soon,
      durationMinutes: 60,
    });
    await owner.admin.from('appointments').update({ status: 'cancelled' }).eq('id', appointmentId);

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(owner.email);
    await page.getByLabel('Palavra-passe').fill(owner.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await expect(page.getByText('Nenhuma marcação.')).toBeVisible();
    await expect(page.getByText('0 hoje')).toBeVisible();
    await expect(page.getByText('Cliente Cancelada')).toHaveCount(0);
  });
});
