import { expect, test, type Page } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

// NEX-205: full E2E coverage of the manual booking wizard (NEX-085,
// NewAppointmentWizard.tsx) end to end — the only prior coverage was the partial
// manual-booking-client-suggestion.spec.ts (NEX-092), which stops at the client step.
// Covers, across the two tests below: existing client, new client, a single service, a
// package plus an extra service not included in it, explicit date/slot selection, an
// optional observation, simple recurrence, success, and the appointment/series actually
// existing (confirmed via the admin client, since a multi-week series won't all show on
// today's agenda).
async function seedBusinessHours(user: ProvisionedTestUser, tenantId: string) {
  // Wide open every day of the week so slot availability never depends on which day this
  // suite happens to run — provision_tenant_owner doesn't create any business_hours by
  // default (same setup already used by appointment-detail.spec.ts's reagendar test).
  await user.admin.from('business_hours').insert(
    Array.from({ length: 7 }, (_, dayOfWeek) => ({
      tenant_id: tenantId,
      day_of_week: dayOfWeek,
      is_open: true,
      opens_at: '00:00',
      closes_at: '23:30',
    })),
  );
}

async function seedSingleService(user: ProvisionedTestUser, tenantId: string) {
  const { data: category } = await user.admin
    .from('service_categories')
    .insert({ tenant_id: tenantId, name: 'Unhas', sort_order: 0 })
    .select('id')
    .single();
  const { data: service } = await user.admin
    .from('services')
    .insert({
      tenant_id: tenantId,
      category_id: category!.id,
      name: 'Manicure Simples',
      price_cents: 1200,
      duration_minutes: 30,
      is_active: true,
    })
    .select('id, name')
    .single();
  return service!;
}

async function seedExistingClient(user: ProvisionedTestUser, tenantId: string) {
  const { data: client } = await user.admin
    .from('clients')
    .insert({ tenant_id: tenantId, name: 'Beatriz Antiga', phone_e164: '+351920000001' })
    .select('id, name')
    .single();
  return client!;
}

async function seedPackageAndExtra(user: ProvisionedTestUser, tenantId: string) {
  const { data: category } = await user.admin
    .from('service_categories')
    .insert({ tenant_id: tenantId, name: 'Unhas', sort_order: 0 })
    .select('id')
    .single();
  const { data: includedService } = await user.admin
    .from('services')
    .insert({
      tenant_id: tenantId,
      category_id: category!.id,
      name: 'Manicure Gel',
      price_cents: 2000,
      duration_minutes: 45,
      is_active: true,
    })
    .select('id, name')
    .single();
  const { data: extraService } = await user.admin
    .from('services')
    .insert({
      tenant_id: tenantId,
      category_id: category!.id,
      name: 'Verniz Extra',
      price_cents: 800,
      duration_minutes: 15,
      is_active: true,
    })
    .select('id, name')
    .single();
  const { data: pkg } = await user.admin
    .from('packages')
    .insert({ tenant_id: tenantId, name: 'Pack Manicure', price_cents: 1800, is_active: true })
    .select('id, name')
    .single();
  await user.admin
    .from('package_services')
    .insert({ tenant_id: tenantId, package_id: pkg!.id, service_id: includedService!.id });
  return { pkg: pkg!, includedService: includedService!, extraService: extraService! };
}

async function login(page: Page, user: ProvisionedTestUser) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(user.email);
  await page.getByLabel('Palavra-passe').fill(user.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe('manual booking wizard complete flow (NEX-205) @critical', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.afterEach(async () => {
    if (user) await cleanupProvisionedTestUser(user);
  });

  test('new client, single service, explicit date/slot and observation — no recurrence', async ({
    page,
  }) => {
    user = await createProvisionedTestUser('nex205-single');
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    const tenantId = tenant!.id;
    await seedBusinessHours(user, tenantId);
    const service = await seedSingleService(user, tenantId);

    await login(page, user);
    await page.goto('/dashboard/agenda/nova');

    // Step 1 — Cliente: "Criar nova cliente" without searching first, so only the
    // always-visible shortcut button exists (the second one only renders once a query of
    // 2+ chars returns zero results).
    await page.getByRole('button', { name: 'Criar nova cliente' }).click();
    await page.getByLabel('Nome').fill('Carolina Nova');
    await page.getByLabel('Telemóvel').fill('910000002');
    await page.getByLabel('E-mail (opcional)').fill('carolina@example.test');
    await page.getByRole('button', { name: 'Continuar' }).click();

    // Step 2 — Serviços: select the single seeded service.
    await page.getByRole('button', { name: new RegExp(service.name) }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();

    // Step 3 — Data e horário: pick the day (the calendar month view only ever shows
    // days within the current calendar month — near month-end, as few as one day may
    // have slots at all, so this clicks the visible day rather than assuming a second
    // one exists), then a slot comfortably away from the very first one offered (which
    // sits right at the min-notice-hours boundary and can flip valid/invalid by the time
    // a later step re-checks it), then an optional observation.
    const dayButtons = page.locator('.calendar-day[data-has-slots="true"]');
    await expect(dayButtons.first()).toBeVisible();
    await dayButtons.first().click();
    const slotButtons = page.locator('.public-slot-button');
    await expect(slotButtons.first()).toBeVisible();
    await slotButtons.nth(Math.min(3, (await slotButtons.count()) - 1)).click();
    await page.getByLabel('Observação (opcional)').fill('Cliente prefere verniz vermelho.');
    await page.getByRole('button', { name: 'Continuar' }).click();

    // Step 4 — Confirmar: review shows the right client/service, then submit.
    // Scoped to the review card — "Carolina Nova" also appears in the sidebar
    // AppointmentSummaryPanel, which would otherwise make this ambiguous.
    const reviewCard = page.locator('.appointment-review-card');
    await expect(reviewCard.getByText('Carolina Nova')).toBeVisible();
    await expect(reviewCard.getByText(service.name)).toBeVisible();
    await page.getByRole('button', { name: 'Criar marcação' }).click();

    // Sucesso.
    await expect(page.getByText('Marcação criada com sucesso!')).toBeVisible();
    await expect(page.getByText('Reservado para Carolina Nova.')).toBeVisible();

    // Marcação visível na agenda.
    await page.getByRole('link', { name: 'Voltar à agenda' }).click();
    await expect(page).toHaveURL(/\/dashboard\/agenda/);
    await expect(
      page.locator('.appointment-timeline-card').getByText('Carolina Nova'),
    ).toBeVisible();

    const { data: appointments } = await user.admin
      .from('appointments')
      .select('id, client_id, source')
      .eq('tenant_id', tenantId);
    expect(appointments).toHaveLength(1);
    expect(appointments![0]!.source).toBe('admin');
  });

  test('existing client, package plus an extra service, with simple weekly recurrence', async ({
    page,
  }) => {
    user = await createProvisionedTestUser('nex205-recurring');
    const { data: tenant } = await user.admin
      .from('tenants')
      .select('id')
      .eq('slug', user.slug)
      .single();
    const tenantId = tenant!.id;
    await seedBusinessHours(user, tenantId);
    const client = await seedExistingClient(user, tenantId);
    const { pkg, includedService, extraService } = await seedPackageAndExtra(user, tenantId);

    await login(page, user);
    await page.goto('/dashboard/agenda/nova');

    // Step 1 — Cliente: search and pick the existing client.
    await page.getByLabel('Pesquisar cliente').fill(client.name);
    await page.getByRole('button', { name: new RegExp(client.name) }).click();
    await expect(page.locator('.selected-client-card')).toContainText(client.name);
    await page.getByRole('button', { name: 'Continuar' }).click();

    // Step 2 — Serviços: pick the package (Pacotes tab), then switch back and add the
    // extra service that isn't part of it.
    await page.getByRole('button', { name: 'Pacotes' }).click();
    await page.getByRole('button', { name: new RegExp(pkg.name) }).click();
    await page.getByRole('button', { name: 'Serviços' }).click();
    await page.getByRole('button', { name: new RegExp(extraService.name) }).click();
    // The service included in the package shows as already selected/disabled, not a
    // separately addable extra.
    await expect(
      page.getByRole('button', { name: new RegExp(includedService.name) }),
    ).toBeDisabled();
    await page.getByRole('button', { name: 'Continuar' }).click();

    // Step 3 — Data e horário: today's default day, first available slot. Used to be
    // impossible here (real bug, fixed in the same round: docs/10_RISK_REGISTER.md R13 —
    // the min-notice-hours boundary wasn't rounded to the slot grid, so a recurring
    // series' first occurrence, whenever it landed on "today", always showed a false
    // "Este horário já está ocupado." on every occurrence). Left as today's own default
    // slot deliberately, instead of navigating to a later month, so this test doubles as
    // an end-to-end regression check for that fix.
    await page.locator('.public-slot-button').first().click();
    await page.getByRole('switch', { name: 'Ativar repetição' }).click();
    await page.getByLabel('Número de marcações (incluindo esta)').fill('3');
    await page.getByRole('button', { name: 'Rever ocorrências' }).click();

    // Rever ocorrências — no conflicts expected on a freshly seeded tenant.
    await expect(page.getByText('Semanal · 3 de 3 marcações')).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar 3 marcações' }).click();

    // Sucesso — a series, not a single appointment.
    await expect(page.getByText('Marcação criada com sucesso!')).toBeVisible();
    await expect(page.getByText(`3 marcações criadas para ${client.name}.`)).toBeVisible();

    // A 3-occurrence weekly series spans ~2 weeks — rather than assert against whatever
    // date the agenda happens to default to, confirm the series itself directly.
    const { data: appointments } = await user.admin
      .from('appointments')
      .select('id, client_id, source, recurring_series_id')
      .eq('tenant_id', tenantId)
      .order('start_at');
    expect(appointments).toHaveLength(3);
    for (const appointment of appointments!) {
      expect(appointment.client_id).toBe(client.id);
      expect(appointment.source).toBe('admin');
      expect(appointment.recurring_series_id).not.toBeNull();
    }
    expect(new Set(appointments!.map((a) => a.recurring_series_id)).size).toBe(1);

    const { data: items } = await user.admin
      .from('appointment_items')
      .select('appointment_id, description')
      .in(
        'appointment_id',
        appointments!.map((a) => a.id),
      );
    const descriptionsByAppointment = new Map<string, string[]>();
    for (const item of items ?? []) {
      const list = descriptionsByAppointment.get(item.appointment_id) ?? [];
      list.push(item.description);
      descriptionsByAppointment.set(item.appointment_id, list);
    }
    for (const appointment of appointments!) {
      const descriptions = descriptionsByAppointment.get(appointment.id) ?? [];
      expect(descriptions).toContain(pkg.name);
      expect(descriptions).toContain(extraService.name);
    }
  });
});
