import { expect, test, type Page } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';
import { completeRegistration } from './support/public-page';

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
test.describe('public fixed cart bar (NEX-054)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.afterEach(async () => {
    await cleanupProvisionedTestUser(user);
  });

  test('no horizontal overflow on a narrow viewport with the bar visible', async ({ page }) => {
    user = await createProvisionedTestUser('nex054');
    await seedManyServices(user);

    await page.goto(`/b/${user.slug}`);
    await expect(page.locator('.public-cart-bar')).toBeVisible();

    await expectNoHorizontalOverflow(page);
  });

  test('shows quantity, duration and total live, and disables "Continuar" when empty', async ({
    page,
  }) => {
    user = await createProvisionedTestUser('nex054');
    await seedManyServices(user);

    await page.goto(`/b/${user.slug}`);

    const bar = page.locator('.public-cart-bar');
    await expect(bar.getByText('0 itens · 0 min · 0,00 €')).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Continuar' })).toBeDisabled();

    await page.getByRole('checkbox', { name: 'Serviço 0' }).check();
    await expect(bar.getByText('1 item · 20 min · 10,00 €')).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Continuar' })).toBeEnabled();

    await page.getByRole('checkbox', { name: 'Serviço 1' }).check();
    await expect(bar.getByText('2 itens · 40 min · 21,00 €')).toBeVisible();
  });

  test('stays fixed at the same viewport position while the page scrolls', async ({ page }) => {
    user = await createProvisionedTestUser('nex054');
    await seedManyServices(user);

    await page.goto(`/b/${user.slug}`);

    const bar = page.locator('.public-cart-bar');
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

  test('"Continuar" scrolls to whichever step is next in the flow', async ({ page }) => {
    user = await createProvisionedTestUser('nex054');
    await seedManyServices(user);

    await page.goto(`/b/${user.slug}`);
    await page.getByRole('checkbox', { name: 'Serviço 0' }).check();
    const cartBarContinue = page.locator('.public-cart-bar').getByRole('button', {
      name: 'Continuar',
    });

    // No slot picked yet — scrolls to Passo 2.
    await cartBarContinue.click();
    await expect(page.locator('#horario')).toBeInViewport();

    await page.locator('.public-slot-picker .public-slot-button').first().click();

    // Slot picked, not registered yet — scrolls to Passo 3.
    await cartBarContinue.click();
    await expect(page.locator('#dados')).toBeInViewport();

    await completeRegistration(page, 'Ana Cliente', '911111111');

    // Registered — scrolls to Passo 4.
    await cartBarContinue.click();
    await expect(page.locator('#confirmar')).toBeInViewport();
    // WhatsApp is now an alternative contact, not the booking mechanism (NEX-065
    // replaced it with a real slot picker + createPublicBooking) — the confirmation
    // card is still what "Continuar" scrolls to.
    await expect(
      page.getByRole('link', { name: 'Prefere combinar por WhatsApp?' }),
    ).toBeInViewport();
  });
});
