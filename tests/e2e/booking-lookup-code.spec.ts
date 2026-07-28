import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';
import { PublicBookingFlow } from './support/public-booking-flow';

// "Consultar marcação por código" — end to end from a completed booking through the
// confirmation screen's lookup code down to /marcacao resolving it back to the booking.
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

test.describe('booking lookup by code', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.afterEach(async () => {
    if (user) await cleanupProvisionedTestUser(user);
  });

  test('shows an 8-character lookup code after confirming, and /marcacao resolves it back to the booking', async ({
    page,
  }) => {
    user = await createProvisionedTestUser('nexlookup');
    await seedOpenTenant(user);
    const flow = new PublicBookingFlow(page);

    await flow.startBooking(user.slug);
    await flow.selectService('Verniz gel');
    await flow.continueFromServices();
    await flow.selectFirstAvailableTime();
    await flow.continueFromHorario();
    await flow.fillClientData({ name: 'Cliente Lookup', phone: '911111111' });
    await flow.reviewBooking();
    await flow.confirmBooking();
    await flow.expectConfirmation();

    const codeText = await page.locator('.public-lookup-code-value').textContent();
    const code = codeText!.trim();
    expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);

    await page.goto('/marcacao');
    await page.getByLabel('Código da marcação').fill(code);
    await page.getByRole('button', { name: 'Consultar marcação' }).click();

    await expect(page.getByText('Marcação Confirmada')).toBeVisible();
    await expect(page.getByText('Total: 25,00 €')).toBeVisible();
  });

  test('shows a clear error for an unknown code', async ({ page }) => {
    user = await createProvisionedTestUser('nexlookup-miss');

    await page.goto('/marcacao');
    await page.getByLabel('Código da marcação').fill('ZZZZZZZZ');
    await page.getByRole('button', { name: 'Consultar marcação' }).click();

    await expect(
      page.getByText('Código não encontrado. Verifique e tente novamente.'),
    ).toBeVisible();
  });
});
