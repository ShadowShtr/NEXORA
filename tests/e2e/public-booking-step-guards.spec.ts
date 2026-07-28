import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';
import { PublicBookingFlow } from './support/public-booking-flow';

async function publishTenantWithService(user: ProvisionedTestUser) {
  const { data: tenant } = await user.admin
    .from('tenants')
    .select('id')
    .eq('slug', user.slug)
    .single();
  await user.admin
    .from('business_settings')
    .update({ published_at: new Date().toISOString(), min_notice_hours: 1 })
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
    duration_minutes: 60,
  });
}

// Minimum contract for each step of the paginated public flow: a visitor who lands
// directly on a later step (a stale bookmark, a shared link, a reload after the draft
// expired) without the state that step depends on is sent back to the earliest step
// that's actually missing, never shown a broken/empty page. Each of the four client
// components (Servicos/Horario/Dados/Resumo) implements its own guard independently
// (src/app/b/[slug]/{servicos,horario,dados,resumo}); this file is what keeps them
// honest as a set, since none of the flow-based specs (public-cart-bar,
// public-booking-draft, etc.) ever visit a step out of order.
test.describe('public booking flow step guards', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.afterEach(async () => {
    await cleanupProvisionedTestUser(user);
  });

  test('/horario redirects to /servicos when nothing is selected', async ({ page }) => {
    user = await createProvisionedTestUser('nexguard');
    await publishTenantWithService(user);

    await page.goto(`/b/${user.slug}/horario`);
    await expect(page).toHaveURL(new RegExp(`/b/${user.slug}/servicos$`));
  });

  test('/dados redirects to /horario when no slot is selected', async ({ page }) => {
    user = await createProvisionedTestUser('nexguard');
    await publishTenantWithService(user);
    const flow = new PublicBookingFlow(page);

    await flow.startBooking(user.slug);
    await flow.selectService('Verniz gel');
    await flow.continueFromServices();

    // Jump straight to /dados instead of picking a slot first.
    await page.goto(`/b/${user.slug}/dados`);
    await expect(page).toHaveURL(new RegExp(`/b/${user.slug}/horario$`));
  });

  test('/resumo redirects all the way back to /servicos when nothing is selected', async ({
    page,
  }) => {
    user = await createProvisionedTestUser('nexguard');
    await publishTenantWithService(user);

    await page.goto(`/b/${user.slug}/resumo`);
    await expect(page).toHaveURL(new RegExp(`/b/${user.slug}/servicos$`));
  });

  test('/resumo redirects to /dados when a slot is selected but registration is missing', async ({
    page,
  }) => {
    user = await createProvisionedTestUser('nexguard');
    await publishTenantWithService(user);
    const flow = new PublicBookingFlow(page);

    await flow.startBooking(user.slug);
    await flow.selectService('Verniz gel');
    await flow.continueFromServices();
    await flow.selectFirstAvailableTime();
    await flow.continueFromHorario();

    // Jump straight to /resumo instead of filling in "Os seus dados".
    await page.goto(`/b/${user.slug}/resumo`);
    await expect(page).toHaveURL(new RegExp(`/b/${user.slug}/dados$`));
  });

  test('completing the flow normally reaches /resumo without any redirect', async ({ page }) => {
    user = await createProvisionedTestUser('nexguard');
    await publishTenantWithService(user);
    const flow = new PublicBookingFlow(page);

    await flow.startBooking(user.slug);
    await flow.selectService('Verniz gel');
    await flow.continueFromServices();
    await flow.selectFirstAvailableTime();
    await flow.continueFromHorario();
    await flow.fillClientData({ name: 'Ana Cliente', phone: '911111111' });
    await flow.reviewBooking();
  });
});
