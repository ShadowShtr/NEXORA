import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

// NEX-083 acceptance criteria: "Consistência com motor" — the free-slots drawer on the
// owner's own agenda must agree with the same availability engine (NEX-061/062) the
// public booking page uses, not a separately maintained count.
async function seedOpenTenant(user: ProvisionedTestUser) {
  const { data: tenant } = await user.admin
    .from('tenants')
    .select('id')
    .eq('slug', user.slug)
    .single();

  await user.admin
    .from('business_settings')
    .update({ min_notice_hours: 1 })
    .eq('tenant_id', tenant!.id);

  await user.admin.from('business_hours').insert(
    Array.from({ length: 7 }, (_, dayOfWeek) => ({
      tenant_id: tenant!.id,
      day_of_week: dayOfWeek,
      is_open: true,
      opens_at: '09:00',
      closes_at: '11:00',
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
    is_active: true,
  });

  return tenant!.id;
}

test.describe('agenda free slots summary (NEX-083)', () => {
  test.skip(!canUseSupabase(), 'Requires Supabase credentials');

  let user: ProvisionedTestUser;

  test.afterEach(async () => {
    if (user) await cleanupProvisionedTestUser(user);
  });

  test('shows a non-zero free slots count for an open tenant with no bookings, and the drawer lists a matching per-day count', async ({
    page,
  }) => {
    user = await createProvisionedTestUser('nex083');
    await seedOpenTenant(user);

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/dashboard/agenda?view=week');

    const summary = page.locator('.agenda-free-slots-summary');
    await expect(summary).toBeVisible();
    await expect(summary).not.toHaveText('0 horários livres neste período');

    await summary.click();
    const dayRows = page.locator('.agenda-free-slots-list li');
    await expect(dayRows.first()).toBeVisible();

    // Sum of per-day counts in the drawer must equal the header total.
    const dayCounts = await dayRows.locator('.agenda-free-slots-day-count').allTextContents();
    const summedFromDrawer = dayCounts.reduce((sum, text) => sum + parseInt(text, 10), 0);
    const headerText = (await summary.textContent()) ?? '';
    const headerTotal = parseInt(headerText.trim(), 10);
    expect(summedFromDrawer).toBe(headerTotal);
  });

  test('an all-day block reduces the free slots count to zero for that day', async ({ page }) => {
    user = await createProvisionedTestUser('nex083-blocked');
    const tenantId = await seedOpenTenant(user);

    const blockStart = new Date();
    blockStart.setUTCHours(0, 0, 0, 0);
    const blockEnd = new Date(blockStart.getTime() + 24 * 60 * 60_000);
    await user.admin.from('availability_blocks').insert({
      tenant_id: tenantId,
      starts_at: blockStart.toISOString(),
      ends_at: blockEnd.toISOString(),
      reason: 'nex083 test block',
      is_all_day: true,
    });

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/dashboard/agenda?view=day');

    // The summary special-cases zero into "Agenda completa..." rather than literally
    // "0 horários livres..." (src/app/(dashboard)/dashboard/agenda/page.tsx) — this
    // assertion never matched that, so it could never have passed for real.
    await expect(page.locator('.agenda-free-slots-summary')).toHaveText(
      'Agenda completa neste período',
    );
  });
});
