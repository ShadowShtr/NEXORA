import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';
import { PublicBookingFlow } from './support/public-booking-flow';

// NEX-203: deterministic visual regression harness — no Percy/Chromatic/external
// service (NEXORA_PLANO_MESTRE...md §5.10 / EPIC-18), just Playwright's own
// `toHaveScreenshot`, comparing against baseline PNGs committed alongside this spec
// (`visual-regression.spec.ts-snapshots/`).
//
// Two deliberate choices keep this maintainable without a rendering-farm service:
//
// 1. Baselines must be generated (and only ever regenerated) by CI's own runner
//    (`ubuntu-latest`, the same one `e2e-critical` already proves Docker/browsers work
//    on) — never from a local machine. Font hinting/anti-aliasing differ enough between
//    operating systems that a baseline captured locally would fail on first CI run
//    for reasons that have nothing to do with an actual visual regression. See
//    `docs/evidence/NEX-203_HARNESS_REGRESSAO_VISUAL.md` for exactly how to generate
//    them (`workflow_dispatch` on the `visual-regression` job with `update: true`).
// 2. Wherever a page can show genuinely static content (a fresh tenant, no
//    appointments yet), the test seeds *that* instead of populating it — an empty
//    state has zero dynamic data (no dates, no relative "há 2 dias", no random avatar
//    initials) and needs no masking at all. The one place this isn't possible (the
//    public booking review/confirmation, which always shows today's real date) uses
//    `mask` to blank out the specific volatile line instead.
test.describe('visual regression harness (NEX-203)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  async function shot(page: Page, name: string, options?: { mask?: Locator[] }) {
    await expect(page).toHaveScreenshot(`${name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
      ...(options?.mask ? { mask: options.mask } : {}),
    });
  }

  test.describe('dashboard (empty tenant)', () => {
    let user: ProvisionedTestUser;

    test.afterEach(async () => {
      if (user) await cleanupProvisionedTestUser(user);
    });

    test('login, Início, Agenda, Clientes, Serviços, Financeiro, Lembretes, Mais, Definições', async ({
      page,
    }) => {
      user = await createProvisionedTestUser('nex203-dash');

      // Login — captured signed out, before any tenant data exists.
      await page.goto('/login');
      await shot(page, 'login');

      await page.getByLabel('E-mail').fill(user.email);
      await page.getByLabel('Palavra-passe').fill(user.password);
      await page.getByRole('button', { name: 'Entrar' }).click();
      await expect(page).toHaveURL(/\/dashboard/);

      // Início — empty tenant: no next appointment, no revenue, no reminders. Masks the
      // greeting date line (always "today", the one unavoidable dynamic text here).
      await shot(page, 'inicio', { mask: [page.locator('.home-date')] });

      // Agenda — fixed ?date= so this never depends on which real day the harness runs
      // on (the calendar/week grid itself is otherwise fully static for an empty tenant).
      await page.goto('/dashboard/agenda?view=day&date=2026-03-16');
      await shot(page, 'agenda-dia');
      await page.goto('/dashboard/agenda?view=week&date=2026-03-16');
      await shot(page, 'agenda-semana');

      // Clientes — empty state.
      await page.goto('/dashboard/clientes');
      await shot(page, 'clientes');

      // Ficha de cliente — needs one real client to have a page at all.
      const { data: tenant } = await user.admin
        .from('tenants')
        .select('id')
        .eq('slug', user.slug)
        .single();
      const { data: client } = await user.admin
        .from('clients')
        .insert({
          tenant_id: tenant!.id,
          name: 'Cliente de Referência',
          phone_e164: '+351910000099',
        })
        .select('id')
        .single();
      await page.goto(`/dashboard/clientes/${client!.id}`);
      await shot(page, 'ficha-cliente');

      // Serviços — one category/service so the list isn't the empty state (already
      // covered structurally by Clientes' empty state above).
      const { data: category } = await user.admin
        .from('service_categories')
        .insert({ tenant_id: tenant!.id, name: 'Unhas', sort_order: 0 })
        .select('id')
        .single();
      await user.admin.from('services').insert({
        tenant_id: tenant!.id,
        category_id: category!.id,
        name: 'Manicure Simples',
        price_cents: 1200,
        duration_minutes: 30,
        is_active: true,
      });
      await page.goto('/dashboard/servicos');
      await shot(page, 'servicos');

      // Financeiro — empty state.
      await page.goto('/dashboard/financeiro');
      await shot(page, 'financeiro');

      // Lembretes — empty state.
      await page.goto('/dashboard/lembretes');
      await shot(page, 'lembretes');

      // Mais — hub page, static regardless of tenant data.
      await page.goto('/dashboard/mais');
      await shot(page, 'mais');

      // Definições — hub page, static regardless of tenant data.
      await page.goto('/dashboard/definicoes');
      await shot(page, 'definicoes');
    });
  });

  test.describe('página pública', () => {
    let user: ProvisionedTestUser;

    test.afterEach(async () => {
      if (user) await cleanupProvisionedTestUser(user);
    });

    test('perfil, serviços, horários, resumo e confirmação', async ({ page }) => {
      user = await createProvisionedTestUser('nex203-public');
      const { data: tenant } = await user.admin
        .from('tenants')
        .select('id')
        .eq('slug', user.slug)
        .single();
      await user.admin
        .from('business_settings')
        .update({
          professional_name: 'Profissional de Referência',
          phone_e164: '+351912345678',
          address_line: 'Rua de Referência, 1',
          postal_code: '1000-001',
          locality: 'Lisboa',
          specialty: 'Manicure e Nail Art',
          booking_enabled: true,
          published_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenant!.id);
      await user.admin.from('tenants').update({ status: 'active' }).eq('id', tenant!.id);
      await user.admin.from('business_hours').insert(
        Array.from({ length: 7 }, (_, dayOfWeek) => ({
          tenant_id: tenant!.id,
          day_of_week: dayOfWeek,
          is_open: true,
          opens_at: '00:00',
          closes_at: '23:30',
        })),
      );
      const { data: category } = await user.admin
        .from('service_categories')
        .insert({ tenant_id: tenant!.id, name: 'Unhas', sort_order: 0 })
        .select('id')
        .single();
      const serviceName = 'Manicure de Referência';
      await user.admin.from('services').insert({
        tenant_id: tenant!.id,
        category_id: category!.id,
        name: serviceName,
        price_cents: 1200,
        duration_minutes: 30,
        is_active: true,
      });

      const flow = new PublicBookingFlow(page);

      await flow.openProfile(user.slug);
      await shot(page, 'publico-perfil');

      await flow.startBooking(user.slug);
      await shot(page, 'publico-servicos');

      await flow.selectService(serviceName);
      await flow.continueFromServices();
      await flow.selectFirstAvailableTime();
      // The date/time strip is inherently "whatever is soonest from today" — the layout
      // is what this harness cares about, not which exact slot ends up highlighted.
      await shot(page, 'publico-horario', { mask: [page.locator('.calendar-month-label')] });

      await flow.continueFromHorario();
      await flow.fillClientData({ name: 'Cliente Visitante', phone: '910000098' });
      await flow.reviewBooking();
      // The review always shows today's real date/time — the one place in this whole
      // harness where masking a specific line is simpler than trying to fake "today".
      await shot(page, 'publico-resumo', { mask: [page.locator('.public-datetime-row')] });

      await flow.confirmBooking();
      await flow.expectConfirmation();
      await shot(page, 'publico-confirmacao', {
        mask: [page.locator('.public-confirmation-details')],
      });
    });
  });
});
