import { expect, test, type Page } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';
import { PublicBookingFlow } from './support/public-booking-flow';

// Same overflow guard used for NEX-044 (catalog-mobile-layout.spec.ts) — the fixed cart
// bar is exactly the kind of element (position: fixed, full width) that can silently
// force horizontal scroll on a narrow viewport if a child doesn't shrink.
async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

// Seeds enough services that the page is taller than the viewport, so scrolling
// actually moves content — needed to prove the bar is really `position: fixed` and not
// just visible because everything fits on one screen already.
async function seedManyServices(user: ProvisionedTestUser) {
  const { data: tenant } = await user.admin
    .from('tenants')
    .select('id')
    .eq('slug', user.slug)
    .single();
  await user.admin
    .from('business_settings')
    .update({
      phone_e164: '+351912345678',
      published_at: new Date().toISOString(),
      min_notice_hours: 1,
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
    .insert({ tenant_id: tenant!.id, name: 'Manicure' })
    .select('id')
    .single();
  for (let i = 0; i < 10; i += 1) {
    await user.admin.from('services').insert({
      tenant_id: tenant!.id,
      category_id: category!.id,
      name: `Serviço ${i}`,
      price_cents: 1000 + i * 100,
      duration_minutes: 20,
    });
  }
}

// NEX-054: PRD 01 §3.6 — "Barra fixa mostra quantidade, duração e valor do carrinho."
// Visual refinement mid-2026 moved selection from the single scrolling page to
// /b/{slug}/servicos and, in the process, dropped the duration figure from the bar's
// own text (ServicosClient only renders count + price) — these tests cover what the
// bar actually shows today; the missing duration is flagged in the PR, not invented
// back in here.
test.describe('public fixed cart bar (NEX-054)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.afterEach(async () => {
    await cleanupProvisionedTestUser(user);
  });

  test('no horizontal overflow on a narrow viewport with the bar visible', async ({ page }) => {
    user = await createProvisionedTestUser('nex054');
    await seedManyServices(user);
    const flow = new PublicBookingFlow(page);

    await flow.startBooking(user.slug);
    await expect(flow.cartBar).toBeVisible();

    await expectNoHorizontalOverflow(page);
  });

  test('shows quantity and total live, and disables "Continuar" when empty', async ({ page }) => {
    user = await createProvisionedTestUser('nex054');
    await seedManyServices(user);
    const flow = new PublicBookingFlow(page);

    await flow.startBooking(user.slug);

    const bar = flow.cartBar;
    await expect(bar.getByText('Total 0 Serviços')).toBeVisible();
    await expect(bar.getByText('0,00 €')).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Continuar' })).toBeDisabled();

    await flow.selectService('Serviço 0');
    await expect(bar.getByText('Total 1 Serviço')).toBeVisible();
    await expect(bar.getByText('10,00 €')).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Continuar' })).toBeEnabled();

    await flow.selectService('Serviço 1');
    await expect(bar.getByText('Total 2 Serviços')).toBeVisible();
    await expect(bar.getByText('21,00 €')).toBeVisible();
  });

  test('stays fixed at the same viewport position while the page scrolls', async ({ page }) => {
    user = await createProvisionedTestUser('nex054');
    await seedManyServices(user);
    const flow = new PublicBookingFlow(page);

    await flow.startBooking(user.slug);

    const bar = flow.cartBar;
    const before = await bar.boundingBox();
    expect(before).not.toBeNull();

    // mouse.wheel isn't supported on mobile WebKit — scroll programmatically instead,
    // which works identically across every project.
    await page.evaluate(() => window.scrollBy(0, 600));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

    const after = await bar.boundingBox();
    expect(after).not.toBeNull();
    expect(after!.y).toBeCloseTo(before!.y, 0);
  });

  test('"Continuar" advances through servicos -> horario -> dados -> resumo', async ({ page }) => {
    user = await createProvisionedTestUser('nex054');
    await seedManyServices(user);
    const flow = new PublicBookingFlow(page);

    await flow.startBooking(user.slug);
    await flow.selectService('Serviço 0');
    await flow.continueFromServices();

    await flow.selectFirstAvailableTime();
    await flow.continueFromHorario();

    await flow.fillClientData({ name: 'Ana Cliente', phone: '911111111' });
    await flow.reviewBooking();
  });
});
