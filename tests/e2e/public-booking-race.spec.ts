import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';
import { PublicBookingFlow } from './support/public-booking-flow';

// NEX-065 acceptance criteria: "E2E corrida de reservas" — two visitors racing for the
// same slot must not both succeed. appointments_no_overlap (NEX-063) is what actually
// decides the winner at the database level; this test proves the *UI* surfaces that
// correctly — the loser sees a clear SLOT_TAKEN message, the slot list refreshes, and
// their cart selection (registration + chosen services) survives so they don't have to
// start over.
async function seedOpenTenant(user: ProvisionedTestUser) {
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

  // Open every day of the week 00:00-23:30 so the test never depends on "today"'s
  // weekday or the current wall-clock hour to find a bookable slot.
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
  await user.admin.from('services').insert({
    tenant_id: tenant!.id,
    category_id: category!.id,
    name: 'Verniz gel',
    price_cents: 2500,
    duration_minutes: 30,
  });

  return tenant!.id;
}

test.describe('public booking race (NEX-065) @critical', () => {
  // NEX-178: a flaky-looking failure here is never noise to retry away — it's either
  // the exact concurrency regression this test exists to catch, or a real transient
  // Postgres deadlock (40P01) that the route handler already retries once server-side
  // (src/app/api/public/business/[slug]/bookings/route.ts). CI's default `retries: 2`
  // (playwright.config.ts) would silently paper over either case, exactly what let PR
  // #135 merge with this test failing. See BUG_2026-07-28_PUBLIC_BOOKING_CLIENT_CONCURRENCY.md.
  test.describe.configure({ retries: 0 });

  let user: ProvisionedTestUser;

  test.afterEach(async () => {
    if (user) await cleanupProvisionedTestUser(user);
  });

  test('when two visitors pick the same slot, only one booking succeeds and the loser sees a clear retry path', async ({
    browser,
  }) => {
    test.skip(!canUseSupabase(), 'Requires Supabase credentials');
    user = await createProvisionedTestUser('nex065');
    const tenantId = await seedOpenTenant(user);

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const flowA = new PublicBookingFlow(pageA);
    const flowB = new PublicBookingFlow(pageB);

    await flowA.startBooking(user.slug);
    await flowB.startBooking(user.slug);

    await flowA.selectService('Verniz gel');
    await flowB.selectService('Verniz gel');
    await flowA.continueFromServices();
    await flowB.continueFromServices();

    // Both visitors see the same computed availability (identical tenant, identical
    // cart duration), so each one's first slot button is the same real-world instant —
    // picking "the first slot" on each page is picking the same slot.
    await flowA.selectFirstAvailableTime();
    await flowB.selectFirstAvailableTime();
    await flowA.continueFromHorario();
    await flowB.continueFromHorario();

    await flowA.fillClientData({ name: 'Cliente A', phone: '911111111' });
    await flowB.fillClientData({ name: 'Cliente B', phone: '922222222' });

    const confirmA = pageA.locator('.public-resumo-confirm');
    const confirmB = pageB.locator('.public-resumo-confirm');

    // Fire both confirmations as close to simultaneously as Playwright allows. A native
    // DOM .click() (bypassing Playwright's CDP input dispatch) was tried during
    // NEX-BOOKING-RACE-001's investigation and reproduced the exact same failure,
    // ruling out Playwright's own click mechanism as the cause.
    await Promise.all([confirmA.click(), confirmB.click()]);

    const successLocatorA = pageA.getByRole('heading', {
      name: 'Marcação confirmada com sucesso!',
    });
    const successLocatorB = pageB.getByRole('heading', {
      name: 'Marcação confirmada com sucesso!',
    });
    // Scoped to .form-error, not a bare getByRole('alert') — Next.js's App Router ships
    // its own route-announcer div with role="alert" on every page (for a11y route-change
    // announcements), which is present and "visible" before the confirm click even
    // resolves. A bare getByRole('alert') matches that announcer too and resolves
    // immediately, without ever waiting for the real SLOT_TAKEN error to render.
    const errorLocatorA = pageA.locator('.form-error[role="alert"]');
    const errorLocatorB = pageB.locator('.form-error[role="alert"]');

    // Generous margin: both requests hit createPublicBooking at once, and the loser's
    // path additionally waits on a redirect + a fresh /horario page load before its
    // alert renders — slower than a single confirm under any normal load.
    await expect(successLocatorA.or(errorLocatorA)).toBeVisible({ timeout: 30_000 });
    await expect(successLocatorB.or(errorLocatorB)).toBeVisible({ timeout: 30_000 });

    const aSucceeded = await successLocatorA.isVisible();
    const bSucceeded = await successLocatorB.isVisible();

    // Exactly one of the two must have won the slot.
    expect(aSucceeded).not.toBe(bSucceeded);

    const loserPage = aSucceeded ? pageB : pageA;
    const loserError = aSucceeded ? errorLocatorB : errorLocatorA;

    await expect(loserError).toHaveText(/reservado por outra pessoa/);
    // The loser is bounced back to /horario (see ResumoClient's SLOT_TAKEN handling) —
    // their registration and selected service still survive in the draft, so they see
    // the (refreshed) slot list rather than starting the whole flow over.
    await expect(loserPage).toHaveURL(/\/horario\?slotTaken=1$/);

    const { count } = await user.admin
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);
    expect(count).toBe(1);

    await contextA.close();
    await contextB.close();
  });
});
