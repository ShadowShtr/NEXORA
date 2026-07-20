import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';
import { completeRegistration } from './support/public-page';

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

test.describe('public booking race (NEX-065)', () => {
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

    await pageA.goto(`/b/${user.slug}`);
    await pageB.goto(`/b/${user.slug}`);

    await pageA.getByRole('checkbox', { name: 'Verniz gel' }).check();
    await pageB.getByRole('checkbox', { name: 'Verniz gel' }).check();

    await pageA.locator('.public-cart-bar').getByRole('button', { name: 'Continuar' }).click();
    await pageB.locator('.public-cart-bar').getByRole('button', { name: 'Continuar' }).click();

    const firstSlotButtonA = pageA.locator('.public-slot-picker .public-slot-button').first();
    const firstSlotButtonB = pageB.locator('.public-slot-picker .public-slot-button').first();
    await expect(firstSlotButtonA).toBeVisible();
    await expect(firstSlotButtonB).toBeVisible();

    // Both visitors see the same computed availability (identical tenant, identical
    // cart duration), so each one's first slot button is the same real-world instant —
    // picking "the first slot" on each page is picking the same slot.
    await firstSlotButtonA.click();
    await firstSlotButtonB.click();

    await completeRegistration(pageA, 'Cliente A', '911111111');
    await completeRegistration(pageB, 'Cliente B', '922222222');

    const confirmA = pageA.getByRole('button', { name: 'Confirmar marcação' });
    const confirmB = pageB.getByRole('button', { name: 'Confirmar marcação' });

    // Fire both confirmations as close to simultaneously as Playwright allows.
    await Promise.all([confirmA.click(), confirmB.click()]);

    const successLocatorA = pageA.getByText('A sua marcação foi confirmada com sucesso.');
    const successLocatorB = pageB.getByText('A sua marcação foi confirmada com sucesso.');
    const errorLocatorA = pageA.getByRole('alert');
    const errorLocatorB = pageB.getByRole('alert');

    await expect(successLocatorA.or(errorLocatorA)).toBeVisible({ timeout: 15_000 });
    await expect(successLocatorB.or(errorLocatorB)).toBeVisible({ timeout: 15_000 });

    const aSucceeded = await successLocatorA.isVisible();
    const bSucceeded = await successLocatorB.isVisible();

    // Exactly one of the two must have won the slot.
    expect(aSucceeded).not.toBe(bSucceeded);

    const loserPage = aSucceeded ? pageB : pageA;
    const loserError = aSucceeded ? errorLocatorB : errorLocatorA;

    await expect(loserError).toHaveText(/reservado por outra pessoa/);
    // Cart survives: the loser's registration and selected service are still present,
    // so they see the (refreshed) slot list rather than starting the whole flow over.
    await expect(loserPage.getByRole('checkbox', { name: 'Verniz gel' })).toBeChecked();

    const { count } = await user.admin
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);
    expect(count).toBe(1);

    await contextA.close();
    await contextB.close();
  });
});
