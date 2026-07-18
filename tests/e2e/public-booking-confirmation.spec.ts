import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';
import { completeRegistration } from './support/public-page';

// NEX-070 acceptance criteria: "Confirmação curta com três ações" — end to end from a
// completed booking through the confirmation screen's three links: ver marcação
// (NEX-071, a readable page at /marcacao/[token]), adicionar ao calendário (NEX-072,
// an .ics download) and abrir localização (NEX-073, a Maps link built from the
// address). Each of those was already unit/integration-tested in isolation in its own
// task — this test is the one place that proves they're actually wired together on the
// real confirmation screen a client sees after booking.
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
      address_line: 'Rua Teste 1',
      postal_code: '1000-000',
      locality: 'Lisboa',
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
  await user.admin.from('services').insert({
    tenant_id: tenant!.id,
    category_id: category!.id,
    name: 'Verniz gel',
    price_cents: 2500,
    duration_minutes: 30,
  });
}

test.describe('public booking confirmation screen (NEX-070)', () => {
  let user: ProvisionedTestUser;

  test.afterEach(async () => {
    if (user) await cleanupProvisionedTestUser(user);
  });

  test('after confirming, the three actions (ver marcação, calendário, localização) are present and functional', async ({
    page,
  }) => {
    test.skip(!canUseSupabase(), 'Requires Supabase credentials');
    user = await createProvisionedTestUser('nex070');
    await seedOpenTenant(user);

    await page.goto(`/b/${user.slug}`);
    await completeRegistration(page, 'Cliente Confirmação', '911111111');
    await page.getByRole('checkbox', { name: 'Verniz gel' }).check();
    await page.locator('.public-cart-bar').getByRole('button', { name: 'Continuar' }).click();

    await page.locator('.public-slot-button').first().click();
    await page.getByRole('button', { name: 'Confirmar marcação' }).click();

    await expect(page.getByText('A sua marcação foi confirmada com sucesso.')).toBeVisible({
      timeout: 15_000,
    });

    const viewBookingLink = page.getByRole('link', { name: 'Ver marcação' });
    const calendarLink = page.getByRole('link', { name: 'Adicionar ao calendário' });
    const mapLink = page.getByRole('link', { name: 'Ver no mapa' });

    await expect(viewBookingLink).toBeVisible();
    await expect(calendarLink).toBeVisible();
    await expect(mapLink).toBeVisible();

    const viewBookingHref = await viewBookingLink.getAttribute('href');
    expect(viewBookingHref).toMatch(/^\/marcacao\/[0-9a-f]{64}$/);

    const calendarHref = await calendarLink.getAttribute('href');
    expect(calendarHref).toMatch(/^\/api\/bookings\/[0-9a-f]{64}\/calendar\.ics$/);

    const mapHref = await mapLink.getAttribute('href');
    expect(mapHref).toContain('google.com/maps');

    // "Ver marcação" leads to a readable page, not the raw JSON API — the whole reason
    // NEX-070 introduced /marcacao/[token] instead of linking GET /api/bookings/{token}
    // directly.
    const bookingPage = await page.context().newPage();
    await bookingPage.goto(viewBookingHref!);
    await expect(bookingPage.getByText('Verniz gel')).toBeVisible();
    await expect(bookingPage.getByText('25,00 €')).toBeVisible();
    await bookingPage.close();

    // The .ics download itself is a real, well-formed calendar file (structural
    // conformance is exhaustively unit-tested in tests/unit/ics.test.ts; this just
    // confirms the button on this screen serves it).
    const icsResponse = await page.request.get(calendarHref!);
    expect(icsResponse.headers()['content-type']).toContain('text/calendar');
    expect(await icsResponse.text()).toContain('BEGIN:VEVENT');
  });
});
